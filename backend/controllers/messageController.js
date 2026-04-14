const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// ── GET /api/messages/:conversationId ───────────────────────────
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 40 } = req.query;

    const conversation = await Conversation.findOne({
      _id:          req.params.conversationId,
      participants: req.user._id,
    });
    if (!conversation)
      return res.status(403).json({ message: 'Access denied' });

    const messages = await Message.find({ conversationId: req.params.conversationId })
      .populate('sender', '_id username avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Message.countDocuments({ conversationId: req.params.conversationId });

    res.json({ messages: messages.reverse(), hasMore: page * limit < total, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/messages ───────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;

    if (!conversationId || !content)
      return res.status(400).json({ message: 'conversationId and content are required' });

    const conversation = await Conversation.findOne({
      _id:          conversationId,
      participants: req.user._id,
    });
    if (!conversation)
      return res.status(403).json({ message: 'Access denied' });

    const message = await Message.create({
      conversationId,
      sender:  req.user._id,
      content,
      readBy:  [req.user._id],
    });

    await message.populate('sender', '_id username avatar');

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt:   new Date(),
    });

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/messages/:conversationId/read ───────────────────────
const markRead = async (req, res) => {
  try {
    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        sender:         { $ne: req.user._id },
        readBy:         { $nin: [req.user._id] },
      },
      {
        $addToSet: { readBy: req.user._id },
        $set:      { status: 'read' },
      }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getMessages, sendMessage, markRead };

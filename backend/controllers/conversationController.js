const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { getIO } = require('../socket');

// ── GET /api/conversations ─────────────────────────────────────── (active only)
const getConversations = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find({ participants: req.user._id, status: 'active' })
        .populate('participants', '_id username avatar isOnline lastSeen')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: '_id username avatar' } })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments({ participants: req.user._id, status: 'active' }),
    ]);

    res.json({ conversations, hasMore: skip + conversations.length < total, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/conversations/requests ──────────────────────────────
// Returns pending message requests where the current user is the RECIPIENT
const getMessageRequests = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
      status: 'request',
      requestedBy: { $ne: req.user._id }, // exclude convos the current user initiated
    })
      .populate('participants', '_id username avatar isOnline lastSeen')
      .populate('requestedBy', '_id username avatar')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: '_id username avatar' },
      })
      .sort({ updatedAt: -1 });

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/conversations ───────────────────────────────────────
// Creates or fetches a conversation, enforcing follow/privacy rules
const getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ message: 'userId is required' });

    if (userId === req.user._id.toString())
      return res.status(400).json({ message: "You can't message yourself" });

    // Check existing conversation (any status)
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 },
    })
      .populate('participants', '_id username avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: '_id username avatar' },
      });

    if (conversation) {
      return res.json({ conversation });
    }

    // Determine if this should be a 'request' or 'active' conversation
    const target = await User.findById(userId).select('profileType followers');
    if (!target) return res.status(404).json({ message: 'User not found' });

    const currentUserFollowsTarget = target.followers.some(
      (f) => f.toString() === req.user._id.toString()
    );

    // Rule: public account OR current user already follows target → active
    // Otherwise → message request
    const isRequest = target.profileType === 'private' && !currentUserFollowsTarget;

    conversation = await Conversation.create({
      participants: [req.user._id, userId],
      status: isRequest ? 'request' : 'active',
      requestedBy: isRequest ? req.user._id : null,
    });

    conversation = await conversation.populate('participants', '_id username avatar isOnline lastSeen');

    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/conversations/:id/accept ────────────────────────────
// Accept a message request → promote to active AND accept any pending follow request
const acceptMessageRequest = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
      status: 'request',
      requestedBy: { $ne: req.user._id }, // only the recipient can accept
    });

    if (!conversation)
      return res.status(404).json({ message: 'Message request not found' });

    conversation.status = 'active';
    conversation.requestedBy = null;
    await conversation.save();

    // ── Also accept the pending follow request from the requester, if any ──
    const requesterId = conversation.participants
      .find((p) => p.toString() !== req.user._id.toString())
      ?.toString();

    if (requesterId) {
      const me = await User.findById(req.user._id).select('followRequests');
      const hasPendingFollowReq = me.followRequests
        .some((id) => id.toString() === requesterId);

      if (hasPendingFollowReq) {
        await User.findByIdAndUpdate(req.user._id, {
          $pull:     { followRequests: requesterId },
          $addToSet: { followers:      requesterId },
        });
        await User.findByIdAndUpdate(requesterId, {
          $addToSet: { following: req.user._id },
        });

        // Notify the requester in real-time
        const io = getIO();
        if (io) {
          io.to(requesterId).emit('followRequestAccepted', {
            acceptedBy: req.user._id.toString(),
            username:   req.user.username,
          });
        }
      }
    }

    const populated = await conversation.populate('participants', '_id username avatar isOnline lastSeen');
    res.json({ conversation: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── DELETE /api/conversations/:id/decline ────────────────────────
// Decline a message request → delete conversation + its messages
const declineMessageRequest = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
      status: 'request',
      requestedBy: { $ne: req.user._id },
    });

    if (!conversation)
      return res.status(404).json({ message: 'Message request not found' });

    await Message.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();

    res.json({ message: 'Message request declined' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── DELETE /api/conversations/:id ───────────────────────────────
// Any participant can delete — removes all messages and the conversation
const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id,
    });

    if (!conversation)
      return res.status(404).json({ message: 'Conversation not found' });

    await Message.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/conversations/:id ───────────────────────────────────
const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id:          req.params.id,
      participants: req.user._id,
    }).populate('participants', '_id username avatar isOnline lastSeen');

    if (!conversation)
      return res.status(404).json({ message: 'Conversation not found' });

    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  getConversations,
  getMessageRequests,
  getOrCreateConversation,
  acceptMessageRequest,
  declineMessageRequest,
  deleteConversation,
  getConversationById,
};

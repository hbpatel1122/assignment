const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Map: userId -> socketId
const onlineUsers = new Map();

let ioInstance = null;
const getIO = () => ioInstance;

const initSocket = (io) => {
  ioInstance = io;
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // Mark online
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Join personal room
    socket.join(userId);

    // Broadcast online status to everyone else
    socket.broadcast.emit('userOnline', { userId });

    // Tell this socket who is currently online (so they don't miss users already connected)
    socket.emit('onlineUsers', { userIds: [...onlineUsers.keys()] });

    // Deliver undelivered messages
    const undelivered = await Message.find({
      sender: { $ne: socket.user._id },
      status: 'sent',
    }).populate({
      path: 'conversationId',
      match: { participants: socket.user._id },
    });

    for (const msg of undelivered) {
      if (msg.conversationId) {
        await Message.findByIdAndUpdate(msg._id, { status: 'delivered' });
        const senderId = msg.sender.toString();
        io.to(senderId).emit('messageStatus', {
          messageId: msg._id,
          status: 'delivered',
          conversationId: msg.conversationId._id,
        });
      }
    }

    // ── SEND MESSAGE ──────────────────────────────────────────────
    socket.on('sendMessage', async ({ conversationId, content, mediaUrl, mediaType }, ack) => {
      try {
        if (!content?.trim() && !mediaUrl) return ack?.({ error: 'Message cannot be empty' });

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id,
        });
        if (!conversation) return ack?.({ error: 'Access denied' });

        const otherUserId = conversation.participants
          .find((p) => p.toString() !== userId)
          ?.toString();

        const isOtherOnline = onlineUsers.has(otherUserId);

        const message = await Message.create({
          conversationId,
          sender: socket.user._id,
          content: content?.trim() || '',
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          type: mediaUrl ? 'image' : 'text',
          status: isOtherOnline ? 'delivered' : 'sent',
          readBy: [socket.user._id],
        });

        await message.populate('sender', '_id username avatar');

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        const payload = { message };

        // Send to other participant
        if (otherUserId) {
          io.to(otherUserId).emit('newMessage', payload);
        }

        // Confirm to sender
        ack?.({ message });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // ── TYPING ────────────────────────────────────────────────────
    socket.on('typing', ({ conversationId, recipientId }) => {
      io.to(recipientId).emit('typing', {
        conversationId,
        userId,
        username: socket.user.username,
      });
    });

    socket.on('stopTyping', ({ conversationId, recipientId }) => {
      io.to(recipientId).emit('stopTyping', { conversationId, userId });
    });

    // ── MARK READ ────────────────────────────────────────────────
    socket.on('markRead', async ({ conversationId, senderId }) => {
      try {
        const result = await Message.updateMany(
          {
            conversationId,
            sender: senderId,
            readBy: { $nin: [socket.user._id] },
          },
          {
            $addToSet: { readBy: socket.user._id },
            $set: { status: 'read' },
          }
        );

        if (result.modifiedCount > 0) {
          io.to(senderId).emit('messageStatus', {
            conversationId,
            status: 'read',
            readBy: userId,
          });
        }
      } catch (err) {
        console.error('markRead error:', err);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      socket.broadcast.emit('userOffline', { userId, lastSeen: new Date() });
    });
  });
};

module.exports = { initSocket, onlineUsers, getIO };

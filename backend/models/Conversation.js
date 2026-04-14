const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  unreadCount: {
    type: Map,
    of: Number,
    default: {},
  },
  // 'active' = normal conversation; 'request' = pending message request (like Instagram)
  status: { type: String, enum: ['active', 'request'], default: 'active' },
  // who sent the message request (the non-follower side)
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

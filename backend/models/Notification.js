const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // follow_request  → someone sent you a follow request
    // follow_accepted → your follow request was accepted
    // new_follower    → someone followed your public account
    type: {
      type: String,
      enum: ['follow_request', 'follow_accepted', 'new_follower'],
      required: true,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index: fast fetch of all notifications for a user, newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });

// TTL index: auto-delete notifications after 3 days (259200 seconds)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 259200 });

module.exports = mongoose.model('Notification', notificationSchema);

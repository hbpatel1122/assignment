const Notification = require('../models/Notification');

// ── GET /api/notifications ───────────────────────────────────────
// Returns paginated, deduplicated notifications for the current user.
// Deduplication: for the same (sender, type) pair only the newest record
// is returned, so any stale DB duplicates are invisible to the client.
const getNotifications = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 15);
    const skip  = (page - 1) * limit;

    // Base aggregation: deduplicate by sender+type, keep newest per pair
    const dedupeStages = [
      { $match: { recipient: req.user._id } },
      { $sort:  { createdAt: -1 } },
      // Keep only the newest document per (sender, type) pair
      { $group: {
          _id:  { sender: '$sender', type: '$type' },
          doc:  { $first: '$$ROOT' },
      }},
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { createdAt: -1 } },
    ];

    // Run count + unread count + paginated data in parallel
    const [countResult, unreadResult, notifications] = await Promise.all([
      // Total deduplicated count
      Notification.aggregate([...dedupeStages, { $count: 'total' }]),
      // Total unread across ALL pages (not just current page)
      Notification.aggregate([
        ...dedupeStages,
        { $match: { read: false } },
        { $count: 'unread' },
      ]),
      // Current page data with sender populated
      Notification.aggregate([
        ...dedupeStages,
        { $skip:  skip  },
        { $limit: limit },
        { $lookup: {
            from:         'users',
            localField:   'sender',
            foreignField: '_id',
            as:           'sender',
            pipeline: [{ $project: { _id: 1, username: 1, avatar: 1 } }],
        }},
        { $unwind: '$sender' },
      ]),
    ]);

    const total       = countResult[0]?.total   ?? 0;
    const unreadCount = unreadResult[0]?.unread  ?? 0;

    res.json({
      notifications,
      total,
      unreadCount,
      page,
      hasMore: skip + notifications.length < total,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/notifications/read-all ─────────────────────────────
// Mark every unread notification for the current user as read.
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/notifications/:id/read ─────────────────────────────
// Mark a single notification as read.
const markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { read: true } }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── DELETE /api/notifications/:id ───────────────────────────────
// Delete a single notification (used after accepting/declining a request).
const deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── DELETE /api/notifications ────────────────────────────────────
// Delete all notifications for the current user.
const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ message: 'All notifications deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getNotifications, markAllRead, markOneRead, deleteNotification, deleteAllNotifications };

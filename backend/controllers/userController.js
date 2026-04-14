const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

// Helper: create a notification and push it to the recipient via socket.
// Deletes any existing notification of the same type between the same users
// before inserting so duplicates can never accumulate.
async function pushNotification({ recipient, sender, type }) {
  await Notification.deleteMany({ recipient, sender, type });
  const notif = await Notification.create({ recipient, sender, type });
  await notif.populate('sender', '_id username avatar');
  const io = getIO();
  if (io) {
    io.to(recipient.toString()).emit('newNotification', { notification: notif });
  }
  return notif;
}

// ── GET /api/users — list all users with follow status ──────────
const getAllUsers = async (req, res) => {
  try {
    const PAGE_SIZE = 10;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const me = await User.findById(req.user._id).select('following');

    const [users, total] = await Promise.all([
      User.find({ _id: { $ne: req.user._id } })
        .select('-password')          // keep followRequests so we can check it below
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      User.countDocuments({ _id: { $ne: req.user._id } }),
    ]);

    const meId         = req.user._id.toString();
    const followingSet = new Set(me.following.map((id) => id.toString()));

    const usersWithStatus = users.map((u) => {
      const obj = u.toObject();
      // hasRequested = my ID is inside this user's followRequests array
      const hasRequested = (u.followRequests || []).some((id) => id.toString() === meId);
      delete obj.followRequests;      // don't expose other users' request lists
      return {
        ...obj,
        isFollowing: followingSet.has(u._id.toString()),
        hasRequested,
      };
    });

    res.json({
      users: usersWithStatus,
      total,
      page,
      hasMore: skip + users.length < total,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/users/search?q= ─────────────────────────────────────
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim())
      return res.json({ users: [] });

    const me = await User.findById(req.user._id).select('following');
    const followingSet = new Set(me.following.map((id) => id.toString()));
    const meId = req.user._id.toString();

    const users = await User.find({
      $or: [
        { username: { $regex: q.trim(), $options: 'i' } },
        { email:    { $regex: q.trim(), $options: 'i' } },
      ],
      _id: { $ne: req.user._id },
    })
      .select('-password')            // keep followRequests so we can check it below
      .limit(20);

    const usersWithStatus = users.map((u) => {
      const obj = u.toObject();
      const hasRequested = (u.followRequests || []).some((id) => id.toString() === meId);
      delete obj.followRequests;
      return {
        ...obj,
        isFollowing:  followingSet.has(u._id.toString()),
        hasRequested,
      };
    });

    res.json({ users: usersWithStatus });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/users/:username ─────────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', '_id username avatar isOnline bio profileType')
      .populate('following', '_id username avatar isOnline bio profileType')
      .populate('followRequests', '_id username avatar isOnline bio profileType');

    if (!user)
      return res.status(404).json({ message: 'User not found' });

    const isOwner     = req.user._id.toString() === user._id.toString();
    const isFollowing = user.followers.some((f) => f._id.toString() === req.user._id.toString());
    const hasRequested = user.followRequests.some((r) => (r._id || r).toString() === req.user._id.toString());

    res.json({ user, isOwner, isFollowing, hasRequested });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── PUT /api/users/profile/update ───────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { bio, profileType, avatar } = req.body;
    const updates = {};

    if (bio         !== undefined) updates.bio = bio;
    if (avatar      !== undefined) updates.avatar = avatar;
    if (profileType && ['public', 'private'].includes(profileType))
      updates.profileType = profileType;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users/:id/follow ───────────────────────────────────
const followUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "You can't follow yourself" });

    const target = await User.findById(req.params.id);
    if (!target)
      return res.status(404).json({ message: 'User not found' });

    if (target.followers.includes(req.user._id))
      return res.status(400).json({ message: 'Already following' });

    if (target.profileType === 'private') {
      if (target.followRequests.includes(req.user._id))
        return res.status(400).json({ message: 'Follow request already sent' });

      await User.findByIdAndUpdate(target._id, { $addToSet: { followRequests: req.user._id } });

      // Notify target about the follow request
      await pushNotification({ recipient: target._id, sender: req.user._id, type: 'follow_request' });

      return res.json({ message: 'Follow request sent', status: 'requested' });
    }

    // Public — follow immediately
    await User.findByIdAndUpdate(target._id, { $addToSet: { followers: req.user._id } });
    await User.findByIdAndUpdate(req.user._id,  { $addToSet: { following: target._id  } });

    // Notify target about the new follower
    await pushNotification({ recipient: target._id, sender: req.user._id, type: 'new_follower' });

    res.json({ message: 'Followed successfully', status: 'following' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users/:id/unfollow ─────────────────────────────────
const unfollowUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id,   { $pull: { followers:      req.user._id   } });
    await User.findByIdAndUpdate(req.user._id,    { $pull: { following:      req.params.id  } });
    await User.findByIdAndUpdate(req.params.id,   { $pull: { followRequests: req.user._id   } });

    // Remove any pending follow_request notification so it doesn't linger
    await Notification.deleteMany({
      recipient: req.params.id,
      sender:    req.user._id,
      type:      'follow_request',
    });

    res.json({ message: 'Unfollowed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users/:id/remove-follower ─────────────────────────
// Remove someone from YOUR followers list (they can no longer see your private content)
const removeFollower = async (req, res) => {
  try {
    // Remove them from my followers
    await User.findByIdAndUpdate(req.user._id,  { $pull: { followers: req.params.id } });
    // Remove me from their following
    await User.findByIdAndUpdate(req.params.id, { $pull: { following: req.user._id } });
    res.json({ message: 'Follower removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users/requests/:id/accept ─────────────────────────
const acceptFollowRequest = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull:    { followRequests: req.params.id },
      $addToSet: { followers:     req.params.id },
    });
    await User.findByIdAndUpdate(req.params.id, {
      $addToSet: { following: req.user._id },
    });

    // Notify the requester via socket (UI update) and persist a notification
    const io = getIO();
    if (io) {
      io.to(req.params.id).emit('followRequestAccepted', {
        acceptedBy: req.user._id.toString(),
        username: req.user.username,
      });
    }

    // Persist follow_accepted notification for the requester
    await pushNotification({ recipient: req.params.id, sender: req.user._id, type: 'follow_accepted' });

    res.json({ message: 'Follow request accepted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/users/requests/:id/reject ─────────────────────────
const rejectFollowRequest = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { followRequests: req.params.id },
    });
    res.json({ message: 'Follow request rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  getAllUsers,
  searchUsers,
  getUserProfile,
  updateProfile,
  followUser,
  unfollowUser,
  removeFollower,
  acceptFollowRequest,
  rejectFollowRequest,
};

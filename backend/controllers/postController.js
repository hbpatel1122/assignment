// ── POST /api/posts/:postId/like — like a post ───────────────
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already liked' });
    }
    post.likes.push(req.user._id);
    await post.save();
    await post.populate('author', '_id username avatar');
    const [postWithCount] = await withCommentCounts([post]);
    res.json({ post: postWithCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/posts/:postId/unlike — unlike a post ───────────
const unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.likes = post.likes.filter((id) => id.toString() !== req.user._id.toString());
    await post.save();
    await post.populate('author', '_id username avatar');
    const [postWithCount] = await withCommentCounts([post]);
    res.json({ post: postWithCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');

/* helper: attach commentCount to an array of post documents */
async function withCommentCounts(posts) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p._id);
  const counts = await Comment.aggregate([
    { $match: { post: { $in: ids } } },
    { $group: { _id: '$post', count: { $sum: 1 } } },
  ]);
  const map = {};
  counts.forEach((c) => { map[c._id.toString()] = c.count; });
  return posts.map((p) => ({ ...p.toObject(), commentCount: map[p._id.toString()] || 0 }));
}

// ── POST /api/posts — create a post ─────────────────────────────
const createPost = async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption } = req.body;
    if (!mediaUrl || !mediaUrl.trim())
      return res.status(400).json({ message: 'Media URL is required' });

    const post = await Post.create({
      author: req.user._id,
      mediaUrl: mediaUrl.trim(),
      mediaType: mediaType || 'image',
      caption: (caption || '').trim(),
    });

    await post.populate('author', '_id username avatar');
    res.status(201).json({ post });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/posts/user/:userId — get user's posts with privacy check + pagination ──
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    // Support both MongoDB ObjectId and username lookup
    const isObjectId = /^[a-fA-F0-9]{24}$/.test(userId);
    let author = isObjectId
      ? await User.findById(userId).select('profileType followers')
      : null;
    if (!author) {
      author = await User.findOne({ username: userId }).select('profileType followers');
    }
    if (!author) return res.status(404).json({ message: 'User not found' });

    const isOwner = req.user._id.toString() === author._id.toString();
    const isFollower = author.followers.some(
      (f) => f.toString() === req.user._id.toString()
    );

    if (author.profileType === 'private' && !isOwner && !isFollower) {
      return res.json({ posts: [], locked: true, total: 0, hasMore: false });
    }

    const [rawPosts, total] = await Promise.all([
      Post.find({ author: author._id })
        .populate('author', '_id username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Post.countDocuments({ author: author._id }),
    ]);

    const posts = await withCommentCounts(rawPosts);
    res.json({ posts, locked: false, total, page, hasMore: skip + rawPosts.length < total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/posts/feed — own + public + followed posts (paginated) ──
const getFeed = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const currentUser = await User.findById(req.user._id).select('following');

    // Public profile users (anyone)
    const publicUsers = await User.find({ profileType: 'public' }).select('_id');
    const publicIds = publicUsers.map((u) => u._id);

    // People the current user follows
    const followingIds = currentUser.following;

    // Merge all unique ObjectIds: self + following + public
    const seen = new Set();
    const authorIds = [];
    for (const id of [req.user._id, ...followingIds, ...publicIds]) {
      const key = id.toString();
      if (!seen.has(key)) { seen.add(key); authorIds.push(id); }
    }

    const [rawPosts, total] = await Promise.all([
      Post.find({ author: { $in: authorIds } })
        .populate('author', '_id username avatar profileType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Post.countDocuments({ author: { $in: authorIds } }),
    ]);

    const posts = await withCommentCounts(rawPosts);
    res.json({ posts, total, page, hasMore: skip + rawPosts.length < total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── DELETE /api/posts/:postId ────────────────────────────────────
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });

    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { createPost, getUserPosts, getFeed, deletePost, likePost, unlikePost };

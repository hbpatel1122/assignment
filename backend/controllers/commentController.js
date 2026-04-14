const Comment = require('../models/Comment');
const User = require('../models/User');

// Create a comment
exports.createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Comment required' });
    const comment = await Comment.create({
      post: postId,
      author: req.user._id,
      content,
    });
    await comment.populate('author', 'username avatar');
    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get paginated comments for a post
exports.getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize) || 10);
    const skip = (page - 1) * pageSize;

    const [comments, total] = await Promise.all([
      Comment.find({ post: postId })
        .populate('author', 'username avatar')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(pageSize),
      Comment.countDocuments({ post: postId })
    ]);

    res.json({
      comments,
      total,
      page,
      pageSize,
      hasMore: skip + comments.length < total,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// (Optional) Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    await comment.deleteOne();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

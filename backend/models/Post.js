const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      default: 'image',
    },
    caption: {
      type: String,
      default: '',
      maxlength: 500,
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: [],
    }],
  },
  { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);

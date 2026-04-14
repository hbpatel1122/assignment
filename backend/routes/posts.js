const express = require('express');
const auth = require('../middleware/auth');
const { createPost, getUserPosts, getFeed, deletePost, likePost, unlikePost } = require('../controllers/postController');

const router = express.Router();


// Like/unlike endpoints
router.post('/:postId/like',      auth, likePost);
router.post('/:postId/unlike',    auth, unlikePost);

router.post('/',                  auth, createPost);
router.get('/feed',               auth, getFeed);
router.get('/user/:userId',       auth, getUserPosts);
router.delete('/:postId',         auth, deletePost);

module.exports = router;

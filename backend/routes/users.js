const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const {
  getAllUsers,
  searchUsers,
  getUserProfile,
  updateProfile,
  followUser,
  unfollowUser,
  removeFollower,
  acceptFollowRequest,
  rejectFollowRequest,
} = require('../controllers/userController');

const router = express.Router();

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

const User = require('../models/User');
router.post('/avatar', auth, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const avatarUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');
    res.json({ user, avatarUrl });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

router.get('/',                          auth, getAllUsers);
router.get('/search',                    auth, searchUsers);
router.put('/profile/update',            auth, updateProfile);
router.post('/requests/:id/accept',      auth, acceptFollowRequest);
router.post('/requests/:id/reject',      auth, rejectFollowRequest);
router.post('/:id/follow',               auth, followUser);
router.post('/:id/unfollow',             auth, unfollowUser);
router.post('/:id/remove-follower',      auth, removeFollower);
router.get('/:username',                 auth, getUserProfile);

module.exports = router;

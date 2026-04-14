// Image filter for chat media (images only)
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
};
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const router = express.Router();

const makeStorage = (folder) => {
  fs.mkdirSync(`uploads/${folder}`, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, `uploads/${folder}`),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
};


const mediaFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
};


// POST /api/upload/media  — post images or videos (max 20MB)
router.post('/media', auth, multer({ storage: makeStorage('posts'), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: mediaFilter }).single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const url = `${process.env.SERVER_URL || 'http://localhost:5000'}/uploads/posts/${req.file.filename}`;
  let type = 'image';
  if (/mp4|mov|avi|mkv/.test(ext)) type = 'video';
  res.json({ url, type });
});

// POST /api/upload/message  — chat media (images up to 10 MB)
router.post('/message', auth, multer({ storage: makeStorage('messages'), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter }).single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${process.env.SERVER_URL || 'http://localhost:5000'}/uploads/messages/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;

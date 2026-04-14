const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  deleteAllNotifications,
} = require('../controllers/notificationController');

router.get('/',               auth, getNotifications);
router.put('/read-all',       auth, markAllRead);
router.put('/:id/read',       auth, markOneRead);
router.delete('/all',         auth, deleteAllNotifications);
router.delete('/:id',         auth, deleteNotification);

module.exports = router;

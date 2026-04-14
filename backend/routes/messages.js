const express = require('express');
const auth = require('../middleware/auth');
const { getMessages, sendMessage, markRead } = require('../controllers/messageController');

const router = express.Router();

router.get('/:conversationId',          auth, getMessages);
router.post('/',                         auth, sendMessage);
router.put('/:conversationId/read',      auth, markRead);

module.exports = router;

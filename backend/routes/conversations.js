const express = require('express');
const auth = require('../middleware/auth');
const {
  getConversations,
  getMessageRequests,
  getOrCreateConversation,
  acceptMessageRequest,
  declineMessageRequest,
  deleteConversation,
  getConversationById,
} = require('../controllers/conversationController');

const router = express.Router();

router.get('/',                    auth, getConversations);
router.get('/requests',            auth, getMessageRequests);
router.post('/',                   auth, getOrCreateConversation);
router.put('/:id/accept',          auth, acceptMessageRequest);
router.delete('/:id/decline',      auth, declineMessageRequest);
router.delete('/:id',              auth, deleteConversation);
router.get('/:id',                 auth, getConversationById);

module.exports = router;

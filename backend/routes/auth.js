const express = require('express');
const auth = require('../middleware/auth');
const {
  signup,
  login,
  getMe,
  verifyEmail,
  resendOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

router.post('/signup',            signup);
router.post('/login',             login);
router.get('/me',                 auth, getMe);
router.post('/verify-email',      auth, verifyEmail);
router.post('/resend-otp',        auth, resendOtp);
router.post('/forgot-password',   forgotPassword);
router.post('/verify-reset-otp',  verifyResetOtp);
router.post('/reset-password',    resetPassword);

module.exports = router;

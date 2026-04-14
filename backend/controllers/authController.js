const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Static OTP used for all verification / password-reset flows
const STATIC_OTP = '123456';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── POST /api/auth/signup ────────────────────────────────────────
const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists)
      return res.status(400).json({ message: 'Email already in use' });

    const usernameExists = await User.findOne({ username });
    if (usernameExists)
      return res.status(400).json({ message: 'Username already taken' });

    const user = await User.create({ username, email, password });
    const token = signToken(user._id);

    res.status(201).json({ token, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid email or password' });

    const token = signToken(user._id);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
};

// ── POST /api/auth/verify-email ──────────────────────────────────
// Body: { otp }   →  always "123456" in this build
const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp)
      return res.status(400).json({ message: 'OTP is required' });

    if (otp !== STATIC_OTP)
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

    if (req.user.isEmailVerified)
      return res.status(400).json({ message: 'Email already verified' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isEmailVerified: true },
      { new: true }
    );

    const token = signToken(user._id);
    res.json({ message: 'Email verified successfully', token, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/auth/resend-otp ────────────────────────────────────
// In production you'd send email; here we just confirm the OTP is 123456
const resendOtp = async (req, res) => {
  try {
    if (req.user.isEmailVerified)
      return res.status(400).json({ message: 'Email already verified' });

    // Static OTP — no actual email sent
    res.json({ message: 'OTP sent to your email (use 123456 for demo)' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/auth/forgot-password ──────────────────────────────
// Body: { email }
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ message: 'No account found with this email' });

    // Static OTP — no email sent in this build
    res.json({ message: 'OTP sent to your email (use 123456 for demo)' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/auth/verify-reset-otp ─────────────────────────────
// Body: { email, otp }
const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ message: 'No account found with this email' });

    if (otp !== STATIC_OTP)
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

    // Issue a short-lived reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'OTP verified', resetToken });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── POST /api/auth/reset-password ───────────────────────────────
// Body: { resetToken, newPassword }
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword)
      return res.status(400).json({ message: 'Reset token and new password are required' });

    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Reset link expired. Please request a new one.' });
    }

    if (decoded.purpose !== 'reset')
      return res.status(400).json({ message: 'Invalid reset token' });

    const user = await User.findById(decoded.id);
    if (!user)
      return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();

    const token = signToken(user._id);
    res.json({ message: 'Password reset successfully', token, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  signup,
  login,
  getMe,
  verifyEmail,
  resendOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};

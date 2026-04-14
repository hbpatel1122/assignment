const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 160 },
    profileType: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },

    // Follow system
    followers:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Presence
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Hash password before save (no next() — Mongoose 7+ async middleware)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    _id:             this._id,
    username:        this.username,
    email:           this.email,
    avatar:          this.avatar,
    bio:             this.bio,
    profileType:     this.profileType,
    isEmailVerified: this.isEmailVerified,
    followers:       this.followers,
    following:       this.following,
    followRequests:  this.followRequests,
    isOnline:        this.isOnline,
    lastSeen:        this.lastSeen,
    createdAt:       this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);

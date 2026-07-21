import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    about: { type: String, default: 'Hey there! I am using ChatApp.', maxlength: 140 },
    // Per-user chat wallpaper preset key — only affects this user's own view.
    chatBackground: { type: String, default: 'default' },
    // Custom uploaded wallpaper (base64 data URL). When set it wins over the preset.
    chatWallpaper: { type: String, default: '' },

    isVerified: { type: Boolean, default: false },

    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    refreshTokens: [
      {
        token: { type: String, select: false },
        expiresAt: { type: Date, select: false },
      },
    ],
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    avatar: this.avatar,
    about: this.about,
    chatBackground: this.chatBackground,
    chatWallpaper: this.chatWallpaper,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);

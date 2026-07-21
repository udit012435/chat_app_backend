import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Invite } from '../models/Invite.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { makeAvatarDataUrl, makeWallpaperDataUrl } from '../utils/image.js';

export const getAllUsers = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;

  const filter = { _id: { $ne: req.userId }, isVerified: true };
  if (search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { email: { $regex: search.trim(), $options: 'i' } },
      { phone: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const [users, invites] = await Promise.all([
    User.find(filter).sort({ name: 1 }),
    Invite.find({ $or: [{ from: req.userId }, { to: req.userId }] }),
  ]);

  const invitesByUser = new Map();
  for (const invite of invites) {
    const otherId = invite.from.toString() === req.userId ? invite.to.toString() : invite.from.toString();
    invitesByUser.set(otherId, invite);
  }

  const data = users.map((user) => {
    const invite = invitesByUser.get(user._id.toString());
    let relation = 'none';
    let inviteId = null;

    if (invite) {
      inviteId = invite._id;
      if (invite.status === 'accepted') {
        relation = 'connected';
      } else if (invite.status === 'pending') {
        relation = invite.from.toString() === req.userId ? 'invited_by_me' : 'invited_by_them';
      } else if (invite.status === 'rejected') {
        relation = invite.from.toString() === req.userId ? 'rejected_by_them' : 'rejected_by_me';
      }
    }

    return { ...user.toSafeJSON(), relation, inviteId };
  });

  res.status(200).json(new ApiResponse(200, data));
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(200).json(new ApiResponse(200, user.toSafeJSON()));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, about, phone, chatBackground } = req.body;
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (name !== undefined) user.name = name.trim();
  if (about !== undefined) user.about = about;
  // Picking a preset means the user no longer wants their uploaded wallpaper.
  if (chatBackground !== undefined) {
    user.chatBackground = chatBackground;
    user.chatWallpaper = '';
  }

  if (phone !== undefined && phone.trim() !== user.phone) {
    const newPhone = phone.trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(newPhone)) {
      throw new ApiError(400, 'Valid phone number is required (with country code)');
    }
    const exists = await User.findOne({ phone: newPhone, _id: { $ne: user._id } });
    if (exists) throw new ApiError(409, 'Phone number already in use');
    user.phone = newPhone;
  }

  await user.save();
  res.status(200).json(new ApiResponse(200, user.toSafeJSON(), 'Profile updated'));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image provided');
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.avatar = await makeAvatarDataUrl(req.file.buffer);
  await user.save();
  res.status(200).json(new ApiResponse(200, user.toSafeJSON(), 'Photo updated'));
});

export const uploadChatWallpaper = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image provided');
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.chatWallpaper = await makeWallpaperDataUrl(req.file.buffer);
  await user.save();
  res.status(200).json(new ApiResponse(200, user.toSafeJSON(), 'Wallpaper updated'));
});

export const removeChatWallpaper = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.chatWallpaper = '';
  await user.save();
  res.status(200).json(new ApiResponse(200, user.toSafeJSON(), 'Wallpaper removed'));
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found');

  const ok = await user.comparePassword(currentPassword || '');
  if (!ok) throw new ApiError(400, 'Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.status(200).json(new ApiResponse(200, null, 'Password updated'));
});

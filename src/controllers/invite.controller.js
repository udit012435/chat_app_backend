import { Invite } from '../models/Invite.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const emitToUser = (req, userId, event, payload) => {
  const io = req.app.get('io');
  io?.to(`user:${userId}`).emit(event, payload);
};

export const sendInvite = asyncHandler(async (req, res) => {
  const { toUserId } = req.body;
  if (toUserId === req.userId) throw new ApiError(400, 'You cannot invite yourself');

  const toUser = await User.findById(toUserId);
  if (!toUser) throw new ApiError(404, 'User not found');

  const existing = await Invite.findOne({
    $or: [
      { from: req.userId, to: toUserId },
      { from: toUserId, to: req.userId },
    ],
  });
  if (existing) {
    if (existing.status === 'accepted') throw new ApiError(409, 'You are already connected');
    if (existing.status === 'pending') throw new ApiError(409, 'An invite is already pending');
    // previously rejected -> allow re-invite by resetting
    existing.from = req.userId;
    existing.to = toUserId;
    existing.status = 'pending';
    await existing.save();
    emitToUser(req, toUserId, 'invite:received', { invite: existing });
    return res.status(200).json(new ApiResponse(200, existing, 'Invite sent'));
  }

  const invite = await Invite.create({ from: req.userId, to: toUserId, status: 'pending' });
  const populated = await invite.populate('from', 'name email avatar about');

  emitToUser(req, toUserId, 'invite:received', { invite: populated });

  res.status(201).json(new ApiResponse(201, populated, 'Invite sent'));
});

export const listInvites = asyncHandler(async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    Invite.find({ to: req.userId, status: 'pending' }).populate('from', 'name email avatar about'),
    Invite.find({ from: req.userId, status: 'pending' }).populate('to', 'name email avatar about'),
  ]);

  res.status(200).json(new ApiResponse(200, { incoming, outgoing }));
});

export const respondInvite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'accept' | 'reject'

  const invite = await Invite.findById(id);
  if (!invite) throw new ApiError(404, 'Invite not found');
  if (invite.to.toString() !== req.userId) throw new ApiError(403, 'Not authorized to respond to this invite');
  if (invite.status !== 'pending') throw new ApiError(400, 'Invite already handled');

  invite.status = action === 'accept' ? 'accepted' : 'rejected';
  await invite.save();

  let conversation = null;
  if (invite.status === 'accepted') {
    conversation = await Conversation.findOne({
      participants: { $all: [invite.from, invite.to], $size: 2 },
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [invite.from, invite.to] });
    }
    conversation = await conversation.populate('participants', 'name email avatar about isOnline lastSeen');
  }

  emitToUser(req, invite.from.toString(), 'invite:responded', { invite, conversation });

  res.status(200).json(new ApiResponse(200, { invite, conversation }, `Invite ${invite.status}`));
});

import { Conversation } from '../models/Conversation.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listMyConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.userId })
    .populate('participants', 'name email avatar about isOnline lastSeen')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

  res.status(200).json(new ApiResponse(200, conversations));
});

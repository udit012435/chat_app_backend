import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { compressUnderLimit, MAX_IMAGE_BYTES } from '../utils/image.js';

const assertParticipant = async (conversationId, userId) => {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conversation) throw new ApiError(403, 'You are not part of this conversation');
  return conversation;
};

export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { before, limit = 30 } = req.query;

  await assertParticipant(conversationId, req.userId);

  const filter = { conversation: conversationId };
  if (before) filter.createdAt = { $lt: new Date(before) };

  await Message.updateMany(
    { conversation: conversationId, sender: { $ne: req.userId }, status: { $ne: 'read' } },
    { $set: { status: 'read' } }
  );

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(parseInt(limit, 10) || 30, 100))
    .populate('sender', 'name avatar');

  res.status(200).json(new ApiResponse(200, messages.reverse()));
});

export const createMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { text } = req.body;

  const conversation = await assertParticipant(conversationId, req.userId);

  const message = await Message.create({ conversation: conversationId, sender: req.userId, text });
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  const populated = await message.populate('sender', 'name avatar');

  const io = req.app.get('io');
  io?.to(`conversation:${conversationId}`).emit('message:new', populated);

  res.status(201).json(new ApiResponse(201, populated, 'Message sent'));
});

export const createImageMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  if (!req.file) throw new ApiError(400, 'No image provided');

  const conversation = await assertParticipant(conversationId, req.userId);

  // ≤ 10 MB → store as-is. Larger → compress down silently (no error to user).
  let data = req.file.buffer;
  let contentType = req.file.mimetype;
  if (data.length > MAX_IMAGE_BYTES) {
    const compressed = await compressUnderLimit(data);
    data = compressed.data;
    contentType = compressed.contentType;
  }

  const message = await Message.create({
    conversation: conversationId,
    sender: req.userId,
    type: 'image',
    text: req.body.caption?.trim() || '',
    imageData: data,
    image: { contentType, size: data.length, name: req.file.originalname },
    status: 'sent',
  });
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  await message.populate('sender', 'name avatar');
  // Never ship the binary over the socket / JSON — clients fetch it lazily.
  const payload = message.toObject();
  delete payload.imageData;

  const io = req.app.get('io');
  io?.to(`conversation:${conversationId}`).emit('message:new', payload);

  res.status(201).json(new ApiResponse(201, payload, 'Image sent'));
});

export const getMessageImage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const message = await Message.findById(messageId).select('+imageData conversation type image');
  if (!message || message.type !== 'image' || !message.imageData) {
    throw new ApiError(404, 'Image not found');
  }
  await assertParticipant(message.conversation, req.userId);

  res.set('Content-Type', message.image?.contentType || 'application/octet-stream');
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(message.imageData);
});

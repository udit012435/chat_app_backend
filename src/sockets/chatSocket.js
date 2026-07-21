import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';

const assertParticipant = async (conversationId, userId) => {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
  return conversation;
};

export const registerChatHandlers = (io, socket) => {
  socket.on('conversation:join', async (conversationId) => {
    const conversation = await assertParticipant(conversationId, socket.userId);
    if (conversation) socket.join(`conversation:${conversationId}`);
  });

  socket.on('conversation:leave', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('typing:start', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      conversationId,
      userId: socket.userId,
    });
  });

  socket.on('typing:stop', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      conversationId,
      userId: socket.userId,
    });
  });

  socket.on('message:send', async ({ conversationId, text }, ack) => {
    try {
      if (!text?.trim()) return ack?.({ ok: false, error: 'Message text is required' });

      const conversation = await assertParticipant(conversationId, socket.userId);
      if (!conversation) return ack?.({ ok: false, error: 'Not part of this conversation' });

      const message = await Message.create({
        conversation: conversationId,
        sender: socket.userId,
        text: text.trim(),
        status: 'sent',
      });
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;
      await conversation.save();

      const populated = await message.populate('sender', 'name avatar');

      io.to(`conversation:${conversationId}`).emit('message:new', populated);
      ack?.({ ok: true, message: populated });
    } catch (err) {
      console.error('[socket] message:send failed', err.message);
      ack?.({ ok: false, error: 'Failed to send message' });
    }
  });

  socket.on('message:read', async ({ conversationId }) => {
    const conversation = await assertParticipant(conversationId, socket.userId);
    if (!conversation) return;

    await Message.updateMany(
      { conversation: conversationId, sender: { $ne: socket.userId }, status: { $ne: 'read' } },
      { $set: { status: 'read' } }
    );

    socket.to(`conversation:${conversationId}`).emit('message:read', {
      conversationId,
      readBy: socket.userId,
    });
  });
};

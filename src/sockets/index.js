import { Server } from 'socket.io';
import { verifyAccessToken } from '../services/token.service.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { registerChatHandlers } from './chatSocket.js';
import { env } from '../config/env.js';

export const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.userId}`);

    await User.findByIdAndUpdate(socket.userId, { isOnline: true });

    const conversations = await Conversation.find({ participants: socket.userId }).select('_id');
    conversations.forEach((c) => socket.join(`conversation:${c._id}`));

    io.emit('presence:update', { userId: socket.userId, isOnline: true });

    registerChatHandlers(io, socket);

    socket.on('disconnect', async () => {
      const remaining = await io.in(`user:${socket.userId}`).fetchSockets();
      if (remaining.length === 0) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen });
        io.emit('presence:update', { userId: socket.userId, isOnline: false, lastSeen });
      }
    });
  });

  return io;
};

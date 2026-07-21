import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });

  await mongoose.connect(env.mongoUri);
};

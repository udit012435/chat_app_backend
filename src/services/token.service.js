import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });

export const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);

export const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

// SHA-256 is enough for high-entropy tokens (unlike passwords, which need bcrypt).
// We store only this hash in the DB and compare hashes on refresh/logout.
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const refreshTokenExpiryDate = () => {
  const days = parseInt(env.jwt.refreshExpiresIn, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

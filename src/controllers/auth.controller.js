import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Otp } from '../models/Otp.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateOtp, hashOtp, compareOtp, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from '../utils/otp.js';
import { sendOtpEmail } from '../services/email.service.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiryDate,
  hashToken,
} from '../services/token.service.js';
import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

// Persistent cookie (maxAge = 7 days) → survives page refresh AND browser close.
// The user stays logged in until the refresh token itself expires (7 days) or
// they log out. `secure` is on in production so it's only sent over HTTPS.
// In production the API and the client sit on different domains, so the cookie
// needs SameSite=None to be sent on the cross-site /refresh call — browsers only
// accept that together with Secure. Locally both run on localhost, where Lax
// works and Secure would stop the cookie from being stored over plain http.
const isProd = env.nodeEnv === 'production';
const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
});

// Create or replace the pending OTP for an email+purpose. Returns the plain OTP
// so it can be emailed. The stored copy is hashed and auto-expires via TTL.
const issueOtp = async (email, purpose) => {
  const otp = generateOtp();
  await Otp.findOneAndUpdate(
    { email, purpose },
    {
      email,
      purpose,
      codeHash: hashOtp(otp),
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return otp;
};

const issueSession = async (res, user) => {
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  // Store only a hash of the refresh token, so a DB leak can't be used to hijack
  // sessions (same idea as hashing passwords).
  user.refreshTokens.push({ token: hashToken(refreshToken), expiresAt: refreshTokenExpiryDate() });
  // keep at most 5 concurrent sessions per user
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  await user.save();

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
  return accessToken;
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { phone }] });
  if (existing && existing.isVerified) {
    throw new ApiError(409, 'An account with this email or phone already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  if (existing) {
    existing.name = name;
    existing.passwordHash = passwordHash;
    user = await existing.save();
  } else {
    user = await User.create({ name, email, phone, passwordHash });
  }

  const otp = await issueOtp(email, 'verify');
  await sendOtpEmail({ toEmail: email, userName: name, otp });

  res
    .status(201)
    .json(new ApiResponse(201, { email: user.email }, 'Registered. OTP sent to your email.'));
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { email, purpose = 'verify' } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, 'No account found with this email');
  if (purpose === 'verify' && user.isVerified) throw new ApiError(400, 'Account already verified');

  const existingOtp = await Otp.findOne({ email, purpose });
  if (existingOtp?.lastSentAt && Date.now() - existingOtp.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new ApiError(429, 'Please wait before requesting another OTP');
  }

  const otp = await issueOtp(email, purpose);
  await sendOtpEmail({ toEmail: email, userName: user.name, otp });

  res.status(200).json(new ApiResponse(200, null, 'OTP resent'));
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, 'No account found with this email');

  const pending = await Otp.findOne({ email, purpose: 'verify' });
  if (!pending) throw new ApiError(400, 'No pending verification for this account');
  if (pending.expiresAt < new Date()) throw new ApiError(400, 'OTP has expired, please request a new one');
  if (!compareOtp(otp, pending.codeHash)) throw new ApiError(400, 'Invalid OTP');

  await Otp.deleteOne({ _id: pending._id });
  user.isVerified = true;
  user.isOnline = true;
  const accessToken = await issueSession(res, user);

  res
    .status(200)
    .json(new ApiResponse(200, { accessToken, user: user.toSafeJSON() }, 'Account verified'));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Invalid email or password');
  if (!user.isVerified) throw new ApiError(403, 'Please verify your email before logging in');

  const valid = await user.comparePassword(password);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  user.isOnline = true;
  const accessToken = await issueSession(res, user);

  res.status(200).json(new ApiResponse(200, { accessToken, user: user.toSafeJSON() }, 'Logged in'));
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw new ApiError(401, 'No refresh token provided');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokens.token +refreshTokens.expiresAt');
  if (!user) throw new ApiError(401, 'Invalid refresh token');

  const stored = user.refreshTokens.find((rt) => rt.token === hashToken(token));
  if (!stored) throw new ApiError(401, 'Refresh token not recognized, please log in again');

  // No rotation: keep the same refresh token and just mint a fresh access token.
  // Rotating on every refresh caused logouts when two refreshes raced with the
  // same cookie (React StrictMode's double-mount, or two open tabs) — the first
  // removed the token from the DB, so the second failed and cleared the session.
  const accessToken = signAccessToken(user._id.toString());

  res.status(200).json(new ApiResponse(200, { accessToken, user: user.toSafeJSON() }, 'Token refreshed'));
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    const payload = (() => {
      try {
        return verifyRefreshToken(token);
      } catch {
        return null;
      }
    })();
    if (payload?.sub) {
      await User.findByIdAndUpdate(payload.sub, {
        $pull: { refreshTokens: { token: hashToken(token) } },
        isOnline: false,
        lastSeen: new Date(),
      });
    }
  }
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
  res.status(200).json(new ApiResponse(200, null, 'Logged out'));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    // Don't leak account existence
    return res.status(200).json(new ApiResponse(200, null, 'If the account exists, an OTP has been sent'));
  }

  const otp = await issueOtp(email, 'reset');
  await sendOtpEmail({ toEmail: email, userName: user.name, otp });

  res.status(200).json(new ApiResponse(200, null, 'If the account exists, an OTP has been sent'));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'Invalid or expired OTP');

  const pending = await Otp.findOne({ email, purpose: 'reset' });
  if (!pending) throw new ApiError(400, 'Invalid or expired OTP');
  if (pending.expiresAt < new Date()) throw new ApiError(400, 'OTP has expired, please request a new one');
  if (!compareOtp(otp, pending.codeHash)) throw new ApiError(400, 'Invalid OTP');

  await Otp.deleteOne({ _id: pending._id });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.refreshTokens = []; // force re-login everywhere
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password reset successful, please log in'));
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, 'User not found');
  res.status(200).json(new ApiResponse(200, user.toSafeJSON()));
});

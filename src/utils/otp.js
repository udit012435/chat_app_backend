import crypto from 'crypto';

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

export const compareOtp = (otp, hash) => hashOtp(otp) === hash;

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

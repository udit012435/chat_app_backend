import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  resendOtp,
  verifyOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
} from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authLimiter, otpLimiter } from '../middlewares/rateLimiter.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

const passwordRule = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters');

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone')
      .trim()
      .matches(/^\+?[1-9]\d{7,14}$/)
      .withMessage('Valid phone number is required (with country code)'),
    passwordRule,
  ],
  validate,
  register
);

router.post(
  '/resend-otp',
  otpLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  resendOtp
);

router.post(
  '/verify-otp',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  validate,
  verifyOtp
);

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  login
);

router.post('/refresh', refresh);
router.post('/logout', logout);

router.post(
  '/forgot-password',
  otpLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  resetPassword
);

router.get('/me', requireAuth, getMe);

export default router;

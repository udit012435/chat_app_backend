import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['verify', 'reset'], required: true },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB's background monitor deletes each document once `expiresAt`
// is in the past (checked roughly once a minute). So an OTP disappears from the
// DB on its own ~10 min after it was issued — no manual cleanup, no bloat.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// At most one active OTP per email + purpose (a new request replaces the old).
otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

export const Otp = mongoose.model('Otp', otpSchema);

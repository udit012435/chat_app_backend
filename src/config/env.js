import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  emailjs: {
    serviceId: process.env.EMAILJS_SERVICE_ID,
    templateId: process.env.EMAILJS_TEMPLATE_ID,
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
    senderEmail: process.env.EMAILJS_SENDER_EMAIL,
  },
};

// Fail at boot rather than on the first request that needs a missing value. The
// JWT secrets have no safe default anywhere; the rest only matter in production,
// where silently falling back to a localhost DB or client URL would be wrong.
const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
if (env.nodeEnv === 'production') {
  required.push(
    'MONGO_URI',
    'CLIENT_URL',
    'EMAILJS_SERVICE_ID',
    'EMAILJS_TEMPLATE_ID',
    'EMAILJS_PUBLIC_KEY'
  );
}

const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[env] Missing required environment variable(s): ${missing.join(', ')}`);
  console.error('[env] See Backend/.env.example for the full list.');
  process.exit(1);
}

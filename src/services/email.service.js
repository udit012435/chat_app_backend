import axios from 'axios';
import { env } from '../config/env.js';

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export const sendOtpEmail = async ({ toEmail, userName, otp }) => {
  const payload = {
    service_id: env.emailjs.serviceId,
    template_id: env.emailjs.templateId,
    user_id: env.emailjs.publicKey,
    template_params: {
      user_name: userName,
      otp,
      email: toEmail,
      to_email: toEmail,
      reply_to: env.emailjs.senderEmail,
    },
  };

  if (env.emailjs.privateKey) {
    payload.accessToken = env.emailjs.privateKey;
  }

  if (env.nodeEnv !== 'production') {
    console.log(`[email:dev] OTP for ${toEmail}: ${otp}`);
  }

  try {
    await axios.post(EMAILJS_ENDPOINT, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data;
    if (status === 403) {
      console.error(
        '[email] EmailJS rejected the request (403). Enable "Allow API calls from non-browser applications" in EmailJS dashboard > Account > Security.'
      );
    }
    console.error('[email] Failed to send OTP email:', detail || err.message);
    if (env.nodeEnv === 'production') {
      throw new Error('Failed to send OTP email');
    }
  }
};

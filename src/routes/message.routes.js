import { Router } from 'express';
import { body } from 'express-validator';
import {
  getMessages,
  createMessage,
  createImageMessage,
  getMessageImage,
} from '../controllers/message.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/image/:messageId', getMessageImage);
router.get('/:conversationId', getMessages);
router.post(
  '/:conversationId',
  [body('text').trim().notEmpty().isLength({ max: 4000 })],
  validate,
  createMessage
);
router.post('/:conversationId/image', uploadImage, createImageMessage);

export default router;

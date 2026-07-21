import { Router } from 'express';
import { listMyConversations } from '../controllers/conversation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', listMyConversations);

export default router;

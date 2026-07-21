import { Router } from 'express';
import { body } from 'express-validator';
import { sendInvite, listInvites, respondInvite } from '../controllers/invite.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', [body('toUserId').isMongoId()], validate, sendInvite);
router.get('/', listInvites);
router.patch(
  '/:id',
  [body('action').isIn(['accept', 'reject'])],
  validate,
  respondInvite
);

export default router;

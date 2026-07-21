import { Router } from 'express';
import {
  getAllUsers,
  getMe,
  updateProfile,
  uploadAvatar,
  uploadChatWallpaper,
  removeChatWallpaper,
  changePassword,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', getAllUsers);
router.get('/me', getMe);
router.patch('/me', updateProfile);
router.patch('/me/avatar', uploadImage, uploadAvatar);
router.patch('/me/wallpaper', uploadImage, uploadChatWallpaper);
router.delete('/me/wallpaper', removeChatWallpaper);
router.patch('/me/password', changePassword);

export default router;

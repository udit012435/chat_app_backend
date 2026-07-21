import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Files are held in memory (not on disk) because we compress and store them in
// MongoDB. The 50 MB cap is just an abuse guard — anything over 10 MB gets
// compressed down automatically, so normal photos never hit an error.
const HARD_LIMIT = 50 * 1024 * 1024;

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HARD_LIMIT },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new ApiError(400, 'Only image files are allowed'));
  },
}).single('image');

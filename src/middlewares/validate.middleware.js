import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ApiError(
        422,
        'Validation failed',
        errors.array().map((e) => ({ field: e.path, message: e.msg }))
      )
    );
  }
  next();
};

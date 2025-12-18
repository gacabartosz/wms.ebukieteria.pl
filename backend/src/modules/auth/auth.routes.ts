import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validation.js';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.validation.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getMe);
router.put('/change-password', authMiddleware, validateBody(changePasswordSchema), authController.changePassword);

export default router;

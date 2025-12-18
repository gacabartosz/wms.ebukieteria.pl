import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validation.js';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from './users.validation.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN'));

router.get('/', usersController.getUsers);
router.get('/:id', usersController.getUserById);
router.post('/', validateBody(createUserSchema), usersController.createUser);
router.put('/:id', validateBody(updateUserSchema), usersController.updateUser);
router.put('/:id/password', validateBody(resetPasswordSchema), usersController.resetPassword);
router.delete('/:id', usersController.deactivateUser);

export default router;

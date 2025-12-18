import { Router } from 'express';
import * as stockController from './stock.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', stockController.getStock);
router.get('/by-code', stockController.getStockByCode);

export default router;

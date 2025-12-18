import { Router } from 'express';
import * as warehousesController from './warehouses.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', warehousesController.getWarehouses);
router.get('/:id', warehousesController.getWarehouseById);
router.post('/', requireRole('ADMIN'), warehousesController.createWarehouse);
router.put('/:id', requireRole('ADMIN'), warehousesController.updateWarehouse);
router.delete('/:id', requireRole('ADMIN'), warehousesController.deactivateWarehouse);

export default router;

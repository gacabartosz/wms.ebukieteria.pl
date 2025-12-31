import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', inventoryController.getInventoryCounts);
router.get('/:id', inventoryController.getInventoryCountById);
router.get('/:id/export', inventoryController.exportInventory);
router.post('/:id/export/pdf', inventoryController.exportInventoryPDF);
router.get('/:id/location', inventoryController.getLocationForCounting);
router.post('/', requireRole('ADMIN', 'MANAGER'), inventoryController.createInventoryCount);
router.post('/:id/lines', inventoryController.addInventoryLine);
router.put('/:id/lines/:lineId', inventoryController.updateInventoryLine);
router.delete('/:id/lines/:lineId', inventoryController.deleteInventoryLine);
router.post('/:id/complete', requireRole('ADMIN', 'MANAGER'), inventoryController.completeInventoryCount);
router.post('/:id/cancel', requireRole('ADMIN', 'MANAGER'), inventoryController.cancelInventoryCount);
router.post('/:id/reopen', requireRole('ADMIN'), inventoryController.reopenInventoryCount);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), inventoryController.updateInventoryCount);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), inventoryController.deleteInventoryCount);

export default router;

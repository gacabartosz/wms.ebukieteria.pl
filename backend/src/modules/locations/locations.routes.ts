import { Router } from 'express';
import * as locationsController from './locations.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', locationsController.getLocations);
router.get('/export', locationsController.exportLocations);
router.get('/by-barcode/:barcode', locationsController.getLocationByBarcode);
router.get('/:id', locationsController.getLocationById);
router.post('/', requireRole('ADMIN', 'MANAGER'), locationsController.createLocation);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), locationsController.updateLocation);
router.put('/:id/status', requireRole('ADMIN', 'MANAGER'), locationsController.updateLocationStatus);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), locationsController.deactivateLocation);

export default router;

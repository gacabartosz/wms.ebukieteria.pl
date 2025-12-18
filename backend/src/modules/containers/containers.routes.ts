import { Router } from 'express';
import * as containersController from './containers.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', containersController.getContainers);
router.get('/export', containersController.exportContainers);
router.get('/by-barcode/:barcode', containersController.getContainerByBarcode);
router.get('/:id', containersController.getContainerById);
router.get('/:id/contents', containersController.getContainerContents);
router.post('/', requireRole('ADMIN', 'MANAGER'), containersController.createContainer);
router.post('/bulk', requireRole('ADMIN', 'MANAGER'), containersController.bulkCreateContainers);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), containersController.updateContainer);
router.put('/:id/move', containersController.moveContainer);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), containersController.deactivateContainer);

export default router;

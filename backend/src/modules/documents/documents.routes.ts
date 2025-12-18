import { Router } from 'express';
import * as documentsController from './documents.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', documentsController.getDocuments);
router.get('/:id', documentsController.getDocumentById);
router.post('/', documentsController.createDocument);
router.post('/:id/lines', documentsController.addDocumentLine);
router.delete('/:id/lines/:lineId', documentsController.deleteDocumentLine);
router.post('/:id/confirm', documentsController.confirmDocument);
router.post('/:id/cancel', documentsController.cancelDocument);

export default router;

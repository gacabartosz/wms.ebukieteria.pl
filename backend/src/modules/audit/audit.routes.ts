import { Router } from 'express';
import * as auditController from './audit.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN', 'MANAGER'));

router.get('/', auditController.getAuditLogs);
router.get('/actions', auditController.getAuditActions);
router.get('/product/:productId', auditController.getProductHistory);
router.get('/location/:locationId', auditController.getLocationHistory);
router.get('/document/:documentId', auditController.getDocumentHistory);

export default router;

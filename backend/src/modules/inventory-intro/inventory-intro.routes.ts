import { Router } from 'express';
import { inventoryIntroController } from './inventory-intro.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Magazyny dostępne dla użytkownika
router.get('/my-warehouses', inventoryIntroController.getUserWarehouses);

// Domyślny magazyn TAR-KWIACIARNIA
router.get('/default-warehouse', inventoryIntroController.getDefaultWarehouse);

// Export (tylko ADMIN)
router.post('/export/excel', requireRole('ADMIN'), inventoryIntroController.exportExcel);
router.post('/export/csv', requireRole('ADMIN'), inventoryIntroController.exportCSV);

// CRUD
router.post('/', inventoryIntroController.create);
router.get('/', inventoryIntroController.getAll);
router.get('/:id', inventoryIntroController.getById);
router.get('/:id/summary', inventoryIntroController.getSummary);

// Linie
router.post('/:id/lines', inventoryIntroController.addLine);
router.patch('/:id/lines/:lineId', inventoryIntroController.updateLine);
router.delete('/:id/lines/:lineId', inventoryIntroController.deleteLine);

// Akcje
router.post('/:id/complete', inventoryIntroController.complete);
router.post('/:id/cancel', inventoryIntroController.cancel);

// Usuwanie inwentaryzacji (tylko ADMIN)
router.delete('/:id', requireRole('ADMIN'), inventoryIntroController.delete);

export default router;

import { Router } from 'express';
import { inventoryIntroController } from './inventory-intro.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Magazyny dostępne dla użytkownika
router.get('/my-warehouses', inventoryIntroController.getUserWarehouses);

// Domyślny magazyn TAR-KWIACIARNIA
router.get('/default-warehouse', inventoryIntroController.getDefaultWarehouse);

// Export (dostępny dla wszystkich zalogowanych - także w trakcie inwentaryzacji)
router.post('/export/excel', inventoryIntroController.exportExcel);
router.post('/export/csv', inventoryIntroController.exportCSV);
router.post('/export/pdf', inventoryIntroController.exportPDF);

// CRUD
router.post('/', inventoryIntroController.create);
router.get('/', inventoryIntroController.getAll);
router.get('/:id', inventoryIntroController.getById);
router.get('/:id/summary', inventoryIntroController.getSummary);

// Linie
router.post('/:id/lines', inventoryIntroController.addLine);
router.patch('/:id/lines/:lineId', inventoryIntroController.updateLine);
router.delete('/:id/lines/:lineId', inventoryIntroController.deleteLine);

// Akcje (tylko ADMIN może zakończyć)
router.post('/:id/complete', requireRole('ADMIN'), inventoryIntroController.complete);
router.post('/:id/cancel', inventoryIntroController.cancel);

// Usuwanie inwentaryzacji (tylko ADMIN)
router.delete('/:id', requireRole('ADMIN'), inventoryIntroController.delete);

export default router;

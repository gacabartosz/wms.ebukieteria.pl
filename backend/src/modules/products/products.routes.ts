import { Router } from 'express';
import * as productsController from './products.controller.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { upload } from '../../config/multer.js';

const router = Router();

router.use(authMiddleware);

router.get('/', productsController.getProducts);
router.get('/search', productsController.searchAutocomplete);  // Autocomplete search
router.get('/export', productsController.exportProducts);
router.get('/by-code/:code', productsController.getProductByCode);
router.get('/:id', productsController.getProductById);
router.post('/', requireRole('ADMIN', 'MANAGER'), productsController.createProduct);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), productsController.updateProduct);
router.post('/:id/image', requireRole('ADMIN', 'MANAGER'), upload.single('image'), productsController.uploadImage);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), productsController.deactivateProduct);

export default router;

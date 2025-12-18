import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Routes
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import warehousesRoutes from './modules/warehouses/warehouses.routes.js';
import locationsRoutes from './modules/locations/locations.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import stockRoutes from './modules/stock/stock.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import containersRoutes from './modules/containers/containers.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/containers', containersRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Nie znaleziono zasobu' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🚀 WMS Backend running on port ${config.port}`);
  console.log(`📡 Health check: http://localhost:${config.port}/health`);
});

export default app;

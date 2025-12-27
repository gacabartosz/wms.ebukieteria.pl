export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'WAREHOUSE';
  permissions?: string[];
  isActive?: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isActive: boolean;
}

export interface Location {
  id: string;
  barcode: string;
  zone: string;
  rack: string;
  shelf: string;
  level: string;
  status: 'ACTIVE' | 'BLOCKED' | 'COUNTING';
  warehouse?: { id: string; code: string };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  ean?: string;
  description?: string;
  unit?: string;
  zone?: string;
  category?: string;
  owner?: string;
  imageUrl?: string;
  priceNetto?: number;
  priceBrutto?: number;
  vatRate?: number;
  isActive: boolean;
}

export interface Stock {
  id: string;
  product: Product;
  location: Location;
  qty: number;
}

export interface Document {
  id: string;
  number: string;
  type: 'PZ' | 'WZ' | 'MM' | 'INV_ADJ';
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  warehouse: { id: string; code: string };
  linesCount: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  confirmedBy?: { id: string; name: string };
  confirmedAt?: string;
}

export interface DocumentLine {
  id: string;
  product: Product;
  fromLocation?: Location;
  toLocation?: Location;
  qty: number;
  scannedBy?: { id: string; name: string };
  scannedAt: string;
}

export interface DocumentDetail extends Document {
  lines: DocumentLine[];
  referenceNo?: string;
  notes?: string;
}

export interface InventoryCount {
  id: string;
  name: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  warehouse: { id: string; code: string; name: string };
  linesCount: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  completedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: { id: string; name: string };
  product?: { id: string; sku: string; name: string };
  fromLocation?: { id: string; barcode: string };
  toLocation?: { id: string; barcode: string };
  document?: { id: string; number: string; type: string };
  qty?: number;
  reason?: string;
  metadata?: {
    barcode?: string;
    containerId?: string;
    fromLocation?: string;
    toLocation?: string;
    productSku?: string;
    countedQty?: number;
    systemQty?: number;
    difference?: number;
    bulk?: boolean;
    count?: number;
    changes?: Record<string, unknown>;
  };
  createdAt: string;
}

export interface Container {
  id: string;
  barcode: string;
  name?: string;
  location?: { id: string; barcode: string; zone?: string };
  stockCount: number;
  createdAt: string;
}

export interface ContainerDetail extends Container {
  stocks: Array<{
    productId: string;
    product: { id: string; sku: string; name: string; ean?: string; imageUrl?: string };
    qty: number;
  }>;
  totalQty: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

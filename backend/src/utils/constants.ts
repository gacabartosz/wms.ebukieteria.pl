export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  WAREHOUSE: 'WAREHOUSE',
} as const;

export const DOCUMENT_TYPES = {
  PZ: 'PZ',
  WZ: 'WZ',
  MM: 'MM',
  INV_ADJ: 'INV_ADJ',
} as const;

export const DOCUMENT_STATUS = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export const LOCATION_STATUS = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  COUNTING: 'COUNTING',
} as const;

export const INVENTORY_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;

export const AUDIT_ACTIONS = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  STOCK_MOVE: 'STOCK_MOVE',
  STOCK_ADJUST: 'STOCK_ADJUST',
  DOC_CREATE: 'DOC_CREATE',
  DOC_CONFIRM: 'DOC_CONFIRM',
  DOC_CANCEL: 'DOC_CANCEL',
  INV_START: 'INV_START',
  INV_CLOSE: 'INV_CLOSE',
  INV_APPROVE: 'INV_APPROVE',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
} as const;

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_TIME_MINUTES = 15;

export const COLUMN_MAPPINGS = {
  product: {
    sku: ['SKU', 'sku', 'Sku', 'KOD', 'Kod', 'kod', 'INDEKS', 'Indeks'],
    ean: ['EAN', 'ean', 'Ean', 'EAN13', 'BARCODE', 'Barcode', 'KOD_KRESKOWY'],
    name: ['Nazwa', 'NAZWA', 'nazwa', 'NAME', 'Name', 'OPIS', 'Opis'],
    unit: ['JM', 'jm', 'Jm', 'JEDNOSTKA', 'Jednostka', 'UNIT', 'Unit'],
    zone: ['Strefa', 'STREFA', 'strefa', 'ZONE', 'Zone', 'KATEGORIA'],
    owner: ['Właściciel', 'WŁAŚCICIEL', 'OWNER', 'Owner', 'KLIENT'],
  },
  location: {
    barcode: ['Kod', 'KOD', 'kod', 'BARCODE', 'Barcode', 'LOKALIZACJA', 'Lokalizacja'],
    zone: ['Strefa', 'STREFA', 'strefa', 'ZONE', 'Zone'],
  },
};

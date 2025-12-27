import prisma from '../../config/database.js';
import { paginationHelper, formatPagination } from '../../utils/helpers.js';

export const getAuditLogs = async (params: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  productId?: string;
  locationId?: string;
  documentId?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = {};

  if (params.action) where.action = params.action;
  if (params.userId) where.userId = params.userId;
  if (params.productId) where.productId = params.productId;
  if (params.documentId) where.documentId = params.documentId;

  if (params.locationId) {
    where.OR = [
      { fromLocationId: params.locationId },
      { toLocationId: params.locationId },
    ];
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
        fromLocation: { select: { id: true, barcode: true } },
        toLocation: { select: { id: true, barcode: true } },
        document: { select: { id: true, number: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: formatPagination(page, limit, total),
  };
};

export const getProductHistory = async (productId: string, params: {
  page?: number;
  limit?: number;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const { skip, take } = paginationHelper(page, limit);

  const where = { productId };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { id: true, name: true } },
        fromLocation: { select: { id: true, barcode: true } },
        toLocation: { select: { id: true, barcode: true } },
        document: { select: { id: true, number: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: formatPagination(page, limit, total),
  };
};

export const getLocationHistory = async (locationId: string, params: {
  page?: number;
  limit?: number;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const { skip, take } = paginationHelper(page, limit);

  const where = {
    OR: [
      { fromLocationId: locationId },
      { toLocationId: locationId },
    ],
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
        fromLocation: { select: { id: true, barcode: true } },
        toLocation: { select: { id: true, barcode: true } },
        document: { select: { id: true, number: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: formatPagination(page, limit, total),
  };
};

export const getDocumentHistory = async (documentId: string) => {
  const logs = await prisma.auditLog.findMany({
    where: { documentId },
    include: {
      user: { select: { id: true, name: true } },
      product: { select: { id: true, sku: true, name: true } },
      fromLocation: { select: { id: true, barcode: true } },
      toLocation: { select: { id: true, barcode: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return { data: logs };
};

export const getAuditActions = () => {
  return {
    data: [
      { value: 'DOC_CREATE', label: 'Utworzenie dokumentu' },
      { value: 'DOC_CONFIRM', label: 'Potwierdzenie dokumentu' },
      { value: 'DOC_CANCEL', label: 'Anulowanie dokumentu' },
      { value: 'STOCK_IN', label: 'Przyjęcie na stan' },
      { value: 'STOCK_OUT', label: 'Wydanie ze stanu' },
      { value: 'STOCK_MOVE', label: 'Przesunięcie' },
      { value: 'STOCK_ADJ', label: 'Korekta inwentaryzacyjna' },
      { value: 'INV_START', label: 'Rozpoczęcie inwentaryzacji' },
      { value: 'INV_COMPLETE', label: 'Zakończenie inwentaryzacji' },
      { value: 'INV_CANCEL', label: 'Anulowanie inwentaryzacji' },
      { value: 'INV_LINE', label: 'Zliczenie produktu (inwentaryzacja)' },
      { value: 'CONTAINER_CREATE', label: 'Utworzenie kuwety' },
      { value: 'CONTAINER_MOVE', label: 'Przeniesienie kuwety' },
      { value: 'CONTAINER_UPDATE', label: 'Aktualizacja kuwety' },
      { value: 'CONTAINER_DELETE', label: 'Usunięcie kuwety' },
      { value: 'USER_LOGIN', label: 'Logowanie' },
      { value: 'USER_LOGOUT', label: 'Wylogowanie' },
      { value: 'USER_CREATE', label: 'Utworzenie użytkownika' },
      { value: 'USER_UPDATE', label: 'Aktualizacja użytkownika' },
      { value: 'PRODUCT_CREATE', label: 'Utworzenie produktu' },
      { value: 'PRODUCT_UPDATE', label: 'Aktualizacja produktu' },
      { value: 'LOCATION_CREATE', label: 'Utworzenie lokalizacji' },
      { value: 'LOCATION_UPDATE', label: 'Aktualizacja lokalizacji' },
      { value: 'WAREHOUSE_CREATE', label: 'Utworzenie magazynu' },
      { value: 'WAREHOUSE_UPDATE', label: 'Aktualizacja magazynu' },
    ],
  };
};

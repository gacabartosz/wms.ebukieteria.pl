import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { paginationHelper, formatPagination } from '../../utils/helpers.js';

export const getStock = async (params: {
  page?: number;
  limit?: number;
  productId?: string;
  locationId?: string;
  warehouseId?: string;
  minQty?: number;
  maxQty?: number;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = { qty: { gt: 0 } };

  if (params.productId) {
    where.productId = params.productId;
  }

  if (params.locationId) {
    where.locationId = params.locationId;
  }

  if (params.warehouseId) {
    where.location = { warehouseId: params.warehouseId };
  }

  if (params.minQty !== undefined) {
    where.qty = { ...where.qty, gte: params.minQty };
  }

  if (params.maxQty !== undefined) {
    where.qty = { ...where.qty, lte: params.maxQty };
  }

  const [stocks, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      skip,
      take,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        location: {
          select: {
            id: true,
            barcode: true,
            warehouse: { select: { code: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.stock.count({ where }),
  ]);

  return {
    data: stocks,
    pagination: formatPagination(page, limit, total),
  };
};

export const getStockByCode = async (params: {
  productCode?: string;
  locationBarcode?: string;
}) => {
  const result: any = {};

  // Find product
  if (params.productCode) {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { ean: params.productCode },
          { sku: { equals: params.productCode, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: { id: true, sku: true, name: true, ean: true, imageUrl: true },
    });

    if (!product) {
      throw new AppError('Produkt nie istnieje', 404, 'PRODUCT_NOT_FOUND');
    }

    result.product = product;

    // Get all stocks for this product
    const stocks = await prisma.stock.findMany({
      where: { productId: product.id, qty: { gt: 0 } },
      include: {
        location: { select: { id: true, barcode: true, zone: true } },
      },
    });

    result.stocks = stocks.map((s) => ({
      location: s.location,
      qty: s.qty,
    }));
    result.totalQty = stocks.reduce((sum, s) => sum + s.qty, 0);
  }

  // Find location
  if (params.locationBarcode) {
    const location = await prisma.location.findUnique({
      where: { barcode: params.locationBarcode.toUpperCase() },
      select: { id: true, barcode: true, zone: true, status: true },
    });

    if (!location) {
      throw new AppError('Lokalizacja nie istnieje', 404, 'LOCATION_NOT_FOUND');
    }

    result.location = location;

    // If we have both product and location, get specific stock
    if (result.product) {
      const stocks = await prisma.stock.findMany({
        where: {
          productId: result.product.id,
          locationId: location.id,
        },
      });

      result.stock = { qty: stocks.reduce((sum, s) => sum + s.qty, 0) };
    } else {
      // Get all stocks for this location
      const stocks = await prisma.stock.findMany({
        where: { locationId: location.id, qty: { gt: 0 } },
        include: {
          product: { select: { id: true, sku: true, name: true, imageUrl: true } },
        },
      });

      result.stocks = stocks.map((s) => ({
        product: s.product,
        qty: s.qty,
      }));
    }
  }

  return result;
};

export const upsertStock = async (
  productId: string,
  locationId: string,
  qtyChange: number,
  containerId?: string | null
): Promise<number> => {
  const existing = await prisma.stock.findFirst({
    where: {
      productId,
      locationId,
      containerId: containerId || null,
    },
  });

  const newQty = (existing?.qty || 0) + qtyChange;

  if (newQty < 0) {
    throw new AppError('Niewystarczający stan magazynowy', 400, 'INSUFFICIENT_STOCK');
  }

  if (existing) {
    const updated = await prisma.stock.update({
      where: { id: existing.id },
      data: { qty: newQty },
    });
    return updated.qty;
  } else {
    if (qtyChange < 0) {
      throw new AppError('Niewystarczający stan magazynowy', 400, 'INSUFFICIENT_STOCK');
    }
    const created = await prisma.stock.create({
      data: { productId, locationId, containerId: containerId || null, qty: qtyChange },
    });
    return created.qty;
  }
};

export const getStockQty = async (productId: string, locationId: string, containerId?: string | null): Promise<number> => {
  const stocks = await prisma.stock.findMany({
    where: {
      productId,
      locationId,
      ...(containerId !== undefined ? { containerId: containerId || null } : {}),
    },
  });

  return stocks.reduce((sum, s) => sum + s.qty, 0);
};

import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { paginationHelper, formatPagination, generateDocumentNumber } from '../../utils/helpers.js';
import * as stockService from '../stock/stock.service.js';

export const getDocuments = async (params: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  createdById?: string;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = {};

  if (params.type) where.type = params.type;
  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.createdById) where.createdById = params.createdById;

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take,
      include: {
        warehouse: { select: { id: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    data: documents.map((d) => ({
      id: d.id,
      number: d.number,
      type: d.type,
      status: d.status,
      warehouse: d.warehouse,
      linesCount: d._count.lines,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
    })),
    pagination: formatPagination(page, limit, total),
  };
};

export const getDocumentById = async (id: string) => {
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
      lines: {
        include: {
          product: { select: { id: true, sku: true, name: true, imageUrl: true } },
          fromLocation: { select: { id: true, barcode: true } },
          toLocation: { select: { id: true, barcode: true } },
          scannedBy: { select: { id: true, name: true } },
        },
        orderBy: { scannedAt: 'desc' },
      },
    },
  });

  if (!document) {
    throw new AppError('Dokument nie istnieje', 404);
  }

  return document;
};

export const createDocument = async (
  userId: string,
  data: {
    type: 'PZ' | 'WZ' | 'MM' | 'INV_ADJ';
    warehouseId: string;
    referenceNo?: string;
    notes?: string;
  }
) => {
  // Generate document number
  const year = new Date().getFullYear();
  const count = await prisma.document.count({
    where: {
      type: data.type,
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });

  const number = generateDocumentNumber(data.type, year, count + 1);

  const document = await prisma.document.create({
    data: {
      number,
      type: data.type,
      warehouseId: data.warehouseId,
      referenceNo: data.referenceNo,
      notes: data.notes,
      createdById: userId,
    },
    include: {
      warehouse: { select: { id: true, code: true } },
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DOC_CREATE',
      documentId: document.id,
      metadata: { type: data.type, number },
    },
  });

  return document;
};

export const addDocumentLine = async (
  userId: string,
  documentId: string,
  data: {
    productCode: string;
    fromLocationBarcode?: string;
    toLocationBarcode?: string;
    qty: number;
  }
) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new AppError('Dokument nie istnieje', 404);
  }

  if (document.status !== 'DRAFT') {
    throw new AppError('Dokument nie jest w statusie DRAFT', 400, 'DOCUMENT_NOT_DRAFT');
  }

  // Find product
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { ean: data.productCode },
        { sku: { equals: data.productCode, mode: 'insensitive' } },
      ],
      isActive: true,
    },
  });

  if (!product) {
    throw new AppError('Produkt nie istnieje', 404, 'PRODUCT_NOT_FOUND', {
      scannedCode: data.productCode,
    });
  }

  // Find locations
  let fromLocation = null;
  let toLocation = null;

  if (data.fromLocationBarcode) {
    fromLocation = await prisma.location.findUnique({
      where: { barcode: data.fromLocationBarcode.toUpperCase() },
    });

    if (!fromLocation) {
      throw new AppError('Lokalizacja źródłowa nie istnieje', 404, 'LOCATION_NOT_FOUND', {
        scannedBarcode: data.fromLocationBarcode,
      });
    }

    if (fromLocation.status === 'COUNTING') {
      throw new AppError('Lokalizacja w trakcie inwentaryzacji', 409, 'LOCATION_COUNTING', {
        location: fromLocation.barcode,
      });
    }

    if (fromLocation.status === 'BLOCKED') {
      throw new AppError('Lokalizacja zablokowana', 409, 'LOCATION_BLOCKED', {
        location: fromLocation.barcode,
      });
    }
  }

  if (data.toLocationBarcode) {
    toLocation = await prisma.location.findUnique({
      where: { barcode: data.toLocationBarcode.toUpperCase() },
    });

    if (!toLocation) {
      throw new AppError('Lokalizacja docelowa nie istnieje', 404, 'LOCATION_NOT_FOUND', {
        scannedBarcode: data.toLocationBarcode,
      });
    }
  }

  // Validate by document type
  if (document.type === 'PZ') {
    if (!toLocation) {
      throw new AppError('Lokalizacja docelowa jest wymagana dla PZ', 400);
    }
  } else if (document.type === 'WZ') {
    if (!fromLocation) {
      throw new AppError('Lokalizacja źródłowa jest wymagana dla WZ', 400);
    }

    // Check available stock
    const availableQty = await stockService.getStockQty(product.id, fromLocation.id);
    if (availableQty < data.qty) {
      throw new AppError('Niewystarczający stan magazynowy', 400, 'INSUFFICIENT_STOCK', {
        available: availableQty,
        requested: data.qty,
        location: fromLocation.barcode,
      });
    }
  } else if (document.type === 'MM') {
    if (!fromLocation || !toLocation) {
      throw new AppError('Obie lokalizacje są wymagane dla MM', 400);
    }

    if (fromLocation.id === toLocation.id) {
      throw new AppError('Lokalizacja źródłowa i docelowa muszą być różne', 400);
    }

    // Check available stock
    const availableQty = await stockService.getStockQty(product.id, fromLocation.id);
    if (availableQty < data.qty) {
      throw new AppError('Niewystarczający stan magazynowy', 400, 'INSUFFICIENT_STOCK', {
        available: availableQty,
        requested: data.qty,
        location: fromLocation.barcode,
      });
    }
  }

  const line = await prisma.documentLine.create({
    data: {
      documentId,
      productId: product.id,
      fromLocationId: fromLocation?.id,
      toLocationId: toLocation?.id,
      qty: data.qty,
      scannedByUserId: userId,
    },
    include: {
      product: { select: { id: true, sku: true, name: true, imageUrl: true } },
      fromLocation: { select: { id: true, barcode: true } },
      toLocation: { select: { id: true, barcode: true } },
    },
  });

  return line;
};

export const deleteDocumentLine = async (documentId: string, lineId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new AppError('Dokument nie istnieje', 404);
  }

  if (document.status !== 'DRAFT') {
    throw new AppError('Dokument nie jest w statusie DRAFT', 400);
  }

  await prisma.documentLine.delete({
    where: { id: lineId },
  });
};

export const confirmDocument = async (userId: string, documentId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      lines: {
        include: {
          product: true,
          fromLocation: true,
          toLocation: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError('Dokument nie istnieje', 404);
  }

  if (document.status !== 'DRAFT') {
    throw new AppError('Dokument nie jest w statusie DRAFT', 400, 'DOCUMENT_NOT_DRAFT');
  }

  if (document.lines.length === 0) {
    throw new AppError('Dokument nie ma żadnych pozycji', 400, 'DOCUMENT_EMPTY');
  }

  // Process stock movements in transaction
  const stockMovements: any[] = [];

  await prisma.$transaction(async (tx) => {
    // Validate and prepare stock movements
    for (const line of document.lines) {
      if (document.type === 'PZ') {
        // Przyjęcie - dodaj do stanu
        const existing = await tx.stock.findFirst({
          where: {
            productId: line.productId,
            locationId: line.toLocationId!,
            containerId: null,
          },
        });

        if (existing) {
          await tx.stock.update({
            where: { id: existing.id },
            data: { qty: existing.qty + line.qty },
          });
        } else {
          await tx.stock.create({
            data: {
              productId: line.productId,
              locationId: line.toLocationId!,
              containerId: null,
              qty: line.qty,
            },
          });
        }

        stockMovements.push({
          product: { sku: line.product.sku },
          location: { barcode: line.toLocation?.barcode },
          qty: line.qty,
          action: 'STOCK_IN',
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'STOCK_IN',
            productId: line.productId,
            toLocationId: line.toLocationId,
            qty: line.qty,
            documentId: document.id,
          },
        });
      } else if (document.type === 'WZ') {
        // Wydanie - odejmij ze stanu (sumuj wszystkie stany dla produktu/lokalizacji)
        const stocks = await tx.stock.findMany({
          where: {
            productId: line.productId,
            locationId: line.fromLocationId!,
          },
        });

        const totalQty = stocks.reduce((sum, s) => sum + s.qty, 0);

        if (totalQty < line.qty) {
          throw new AppError('Niewystarczający stan magazynowy', 400, 'INSUFFICIENT_STOCK', {
            product: line.product.sku,
            location: line.fromLocation?.barcode,
            available: totalQty,
            requested: line.qty,
          });
        }

        // Odejmij od pierwszego stanu z wystarczającą ilością lub od wielu
        let remaining = line.qty;
        for (const stock of stocks) {
          if (remaining <= 0) break;
          const toDeduct = Math.min(stock.qty, remaining);
          await tx.stock.update({
            where: { id: stock.id },
            data: { qty: stock.qty - toDeduct },
          });
          remaining -= toDeduct;
        }

        stockMovements.push({
          product: { sku: line.product.sku },
          location: { barcode: line.fromLocation?.barcode },
          qty: line.qty,
          action: 'STOCK_OUT',
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'STOCK_OUT',
            productId: line.productId,
            fromLocationId: line.fromLocationId,
            qty: line.qty,
            documentId: document.id,
          },
        });
      } else if (document.type === 'MM') {
        // Przesunięcie - odejmij z FROM, dodaj do TO
        const fromStocks = await tx.stock.findMany({
          where: {
            productId: line.productId,
            locationId: line.fromLocationId!,
          },
        });

        const fromTotalQty = fromStocks.reduce((sum, s) => sum + s.qty, 0);

        if (fromTotalQty < line.qty) {
          throw new AppError('Niewystarczający stan magazynowy', 400, 'INSUFFICIENT_STOCK', {
            product: line.product.sku,
            location: line.fromLocation?.barcode,
            available: fromTotalQty,
            requested: line.qty,
          });
        }

        // Decrease from source
        let remaining = line.qty;
        for (const stock of fromStocks) {
          if (remaining <= 0) break;
          const toDeduct = Math.min(stock.qty, remaining);
          await tx.stock.update({
            where: { id: stock.id },
            data: { qty: stock.qty - toDeduct },
          });
          remaining -= toDeduct;
        }

        // Increase at destination
        const toStock = await tx.stock.findFirst({
          where: {
            productId: line.productId,
            locationId: line.toLocationId!,
            containerId: null,
          },
        });

        if (toStock) {
          await tx.stock.update({
            where: { id: toStock.id },
            data: { qty: toStock.qty + line.qty },
          });
        } else {
          await tx.stock.create({
            data: {
              productId: line.productId,
              locationId: line.toLocationId!,
              containerId: null,
              qty: line.qty,
            },
          });
        }

        stockMovements.push({
          product: { sku: line.product.sku },
          fromLocation: { barcode: line.fromLocation?.barcode },
          toLocation: { barcode: line.toLocation?.barcode },
          qty: line.qty,
          action: 'STOCK_MOVE',
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'STOCK_MOVE',
            productId: line.productId,
            fromLocationId: line.fromLocationId,
            toLocationId: line.toLocationId,
            qty: line.qty,
            documentId: document.id,
          },
        });
      }
    }

    // Update document status
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: 'CONFIRMED',
        confirmedById: userId,
        confirmedAt: new Date(),
      },
    });

    // Create confirm audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'DOC_CONFIRM',
        documentId: document.id,
      },
    });
  });

  const confirmedDoc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      confirmedBy: { select: { id: true, name: true } },
    },
  });

  return {
    ...confirmedDoc,
    stockMovements,
  };
};

export const cancelDocument = async (userId: string, documentId: string, reason?: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new AppError('Dokument nie istnieje', 404);
  }

  if (document.status !== 'DRAFT') {
    throw new AppError('Tylko dokumenty w statusie DRAFT mogą być anulowane', 400);
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'CANCELLED' },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DOC_CANCEL',
      documentId,
      reason,
    },
  });

  return { id: documentId, status: 'CANCELLED' };
};

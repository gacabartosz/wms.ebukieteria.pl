import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { paginationHelper, formatPagination } from '../../utils/helpers.js';

export const getInventoryCounts = async (params: {
  page?: number;
  limit?: number;
  status?: string;
  warehouseId?: string;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = {};

  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;

  const [counts, total] = await Promise.all([
    prisma.inventoryCount.findMany({
      where,
      skip,
      take,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryCount.count({ where }),
  ]);

  return {
    data: counts.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      warehouse: c.warehouse,
      linesCount: c._count.lines,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      completedAt: c.completedAt,
    })),
    pagination: formatPagination(page, limit, total),
  };
};

export const getInventoryCountById = async (id: string) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      lines: {
        include: {
          location: { select: { id: true, barcode: true, zone: true } },
          product: { select: { id: true, sku: true, name: true, imageUrl: true, ean: true, priceBrutto: true } },
          countedBy: { select: { id: true, name: true } },
        },
        orderBy: { countedAt: 'desc' },
      },
    },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  return inventoryCount;
};

export const createInventoryCount = async (
  userId: string,
  data: {
    name: string;
    warehouseId: string;
    locationIds?: string[];
  }
) => {
  // Create inventory count
  const inventoryCount = await prisma.inventoryCount.create({
    data: {
      name: data.name,
      warehouseId: data.warehouseId,
      createdById: userId,
    },
    include: {
      warehouse: { select: { id: true, code: true } },
    },
  });

  // If locationIds provided, block those locations
  if (data.locationIds && data.locationIds.length > 0) {
    await prisma.location.updateMany({
      where: { id: { in: data.locationIds } },
      data: { status: 'COUNTING' },
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'INV_START',
      metadata: { inventoryId: inventoryCount.id, name: data.name },
    },
  });

  return inventoryCount;
};

export const addInventoryLine = async (
  userId: string,
  inventoryId: string,
  data: {
    locationBarcode: string;
    productCode: string;
    countedQty: number;
  }
) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  if (inventoryCount.status !== 'IN_PROGRESS') {
    throw new AppError('Inwentaryzacja nie jest w trakcie', 400, 'INVENTORY_NOT_IN_PROGRESS');
  }

  // Find location
  const location = await prisma.location.findUnique({
    where: { barcode: data.locationBarcode.toUpperCase() },
  });

  if (!location) {
    throw new AppError('Lokalizacja nie istnieje', 404, 'LOCATION_NOT_FOUND', {
      scannedBarcode: data.locationBarcode,
    });
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

  // Get current system quantity (sum of all stock for this product at this location)
  const stocks = await prisma.stock.findMany({
    where: {
      productId: product.id,
      locationId: location.id,
    },
  });

  const systemQty = stocks.reduce((sum, s) => sum + s.qty, 0);

  // Check if line already exists
  const existingLine = await prisma.inventoryLine.findFirst({
    where: {
      inventoryCountId: inventoryId,
      locationId: location.id,
      productId: product.id,
    },
  });

  if (existingLine) {
    // Update existing line
    const updatedLine = await prisma.inventoryLine.update({
      where: { id: existingLine.id },
      data: {
        countedQty: data.countedQty,
        countedByUserId: userId,
        countedAt: new Date(),
      },
      include: {
        location: { select: { id: true, barcode: true } },
        product: { select: { id: true, sku: true, name: true, imageUrl: true } },
        countedBy: { select: { id: true, name: true } },
      },
    });

    // Audit log for inventory line update
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'INV_LINE',
        productId: product.id,
        fromLocationId: location.id,
        qty: data.countedQty,
        metadata: {
          inventoryId,
          systemQty,
          countedQty: data.countedQty,
          difference: data.countedQty - systemQty,
          locationBarcode: location.barcode,
          productSku: product.sku,
          updated: true,
        },
      },
    });

    return {
      ...updatedLine,
      systemQty,
      difference: data.countedQty - systemQty,
    };
  }

  // Create new line
  const line = await prisma.inventoryLine.create({
    data: {
      inventoryCountId: inventoryId,
      locationId: location.id,
      productId: product.id,
      systemQty,
      countedQty: data.countedQty,
      countedByUserId: userId,
    },
    include: {
      location: { select: { id: true, barcode: true } },
      product: { select: { id: true, sku: true, name: true, imageUrl: true } },
      countedBy: { select: { id: true, name: true } },
    },
  });

  // Audit log for inventory line
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'INV_LINE',
      productId: product.id,
      fromLocationId: location.id,
      qty: data.countedQty,
      metadata: {
        inventoryId,
        systemQty,
        countedQty: data.countedQty,
        difference: data.countedQty - systemQty,
        locationBarcode: location.barcode,
        productSku: product.sku,
      },
    },
  });

  return {
    ...line,
    difference: data.countedQty - systemQty,
  };
};

export const completeInventoryCount = async (userId: string, inventoryId: string) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
    include: {
      lines: {
        include: {
          product: true,
          location: true,
        },
      },
    },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  if (inventoryCount.status !== 'IN_PROGRESS') {
    throw new AppError('Inwentaryzacja nie jest w trakcie', 400);
  }

  if (inventoryCount.lines.length === 0) {
    throw new AppError('Inwentaryzacja nie ma żadnych pozycji', 400, 'INVENTORY_EMPTY');
  }

  // Process adjustments in transaction
  const adjustments: any[] = [];

  await prisma.$transaction(async (tx) => {
    for (const line of inventoryCount.lines) {
      const difference = line.countedQty - line.systemQty;

      if (difference !== 0) {
        // Update stock (find without container for inventory adjustments)
        const existingStock = await tx.stock.findFirst({
          where: {
            productId: line.productId,
            locationId: line.locationId,
            containerId: null,
          },
        });

        if (existingStock) {
          await tx.stock.update({
            where: { id: existingStock.id },
            data: { qty: line.countedQty },
          });
        } else if (line.countedQty > 0) {
          await tx.stock.create({
            data: {
              productId: line.productId,
              locationId: line.locationId,
              containerId: null,
              qty: line.countedQty,
            },
          });
        }

        adjustments.push({
          product: { sku: line.product.sku },
          location: { barcode: line.location.barcode },
          systemQty: line.systemQty,
          countedQty: line.countedQty,
          difference,
        });

        // Create audit log for adjustment
        await tx.auditLog.create({
          data: {
            userId,
            action: 'STOCK_ADJ',
            productId: line.productId,
            fromLocationId: line.locationId,
            qty: difference,
            metadata: {
              inventoryId: inventoryCount.id,
              systemQty: line.systemQty,
              countedQty: line.countedQty,
            },
          },
        });
      }
    }

    // Get unique location IDs from lines
    const locationIds = [...new Set(inventoryCount.lines.map((l) => l.locationId))];

    // Unblock locations
    await tx.location.updateMany({
      where: { id: { in: locationIds }, status: 'COUNTING' },
      data: { status: 'ACTIVE' },
    });

    // Update inventory count status
    await tx.inventoryCount.update({
      where: { id: inventoryId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Create completion audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'INV_COMPLETE',
        metadata: {
          inventoryId: inventoryCount.id,
          adjustmentsCount: adjustments.length,
        },
      },
    });
  });

  return {
    id: inventoryId,
    status: 'COMPLETED',
    adjustments,
    adjustmentsCount: adjustments.length,
  };
};

export const cancelInventoryCount = async (userId: string, inventoryId: string) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
    include: {
      lines: true,
    },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  if (inventoryCount.status !== 'IN_PROGRESS') {
    throw new AppError('Tylko inwentaryzacje w trakcie mogą być anulowane', 400);
  }

  // Get unique location IDs from lines
  const locationIds = [...new Set(inventoryCount.lines.map((l) => l.locationId))];

  await prisma.$transaction(async (tx) => {
    // Unblock locations
    if (locationIds.length > 0) {
      await tx.location.updateMany({
        where: { id: { in: locationIds }, status: 'COUNTING' },
        data: { status: 'ACTIVE' },
      });
    }

    // Update status
    await tx.inventoryCount.update({
      where: { id: inventoryId },
      data: { status: 'CANCELLED' },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'INV_CANCEL',
        metadata: { inventoryId },
      },
    });
  });

  return { id: inventoryId, status: 'CANCELLED' };
};

export const getLocationForCounting = async (inventoryId: string, barcode: string) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  const normalizedBarcode = barcode.toUpperCase();

  // Only handle location barcodes - containers are handled separately via containersService
  const location = await prisma.location.findUnique({
    where: { barcode: normalizedBarcode },
  });

  if (!location) {
    throw new AppError('Lokalizacja nie istnieje', 404, 'LOCATION_NOT_FOUND');
  }

  // Get all stocks at this location
  const stocks = await prisma.stock.findMany({
    where: { locationId: location.id, qty: { gt: 0 } },
    include: {
      product: { select: { id: true, sku: true, name: true, imageUrl: true, ean: true } },
    },
  });

  // Get already counted lines for this location in this inventory
  const countedLines = await prisma.inventoryLine.findMany({
    where: {
      inventoryCountId: inventoryId,
      locationId: location.id,
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  });

  return {
    location: {
      id: location.id,
      barcode: location.barcode,
      zone: location.zone,
    },
    container: null,
    expectedProducts: stocks.map((s) => ({
      product: s.product,
      systemQty: s.qty,
    })),
    countedLines: countedLines.map((l) => ({
      product: l.product,
      systemQty: l.systemQty,
      countedQty: l.countedQty,
      difference: l.countedQty - l.systemQty,
    })),
  };
};

export const getInventoryForExport = async (id: string) => {
  const inventory = await prisma.inventoryCount.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: {
        include: {
          location: { select: { barcode: true } },
          product: { select: { sku: true, name: true } },
          countedBy: { select: { name: true } },
        },
        orderBy: [{ location: { barcode: 'asc' } }, { product: { sku: 'asc' } }],
      },
    },
  });

  if (!inventory) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  return inventory;
};

export const updateInventoryCount = async (id: string, data: { name?: string }) => {
  const inventory = await prisma.inventoryCount.findUnique({
    where: { id },
  });

  if (!inventory) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  const updated = await prisma.inventoryCount.update({
    where: { id },
    data: {
      name: data.name,
    },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  return updated;
};

export const deleteInventoryCount = async (id: string) => {
  const inventory = await prisma.inventoryCount.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!inventory) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  // Delete all lines first, then the inventory
  await prisma.$transaction([
    prisma.inventoryLine.deleteMany({ where: { inventoryCountId: id } }),
    prisma.inventoryCount.delete({ where: { id } }),
  ]);
};

export const updateInventoryLine = async (
  userId: string,
  inventoryId: string,
  lineId: string,
  data: { countedQty: number }
) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  if (inventoryCount.status !== 'IN_PROGRESS') {
    throw new AppError('Inwentaryzacja nie jest w trakcie', 400);
  }

  const line = await prisma.inventoryLine.findUnique({
    where: { id: lineId },
    include: {
      product: { select: { sku: true } },
      location: { select: { barcode: true } },
    },
  });

  if (!line || line.inventoryCountId !== inventoryId) {
    throw new AppError('Linia nie istnieje', 404);
  }

  const updatedLine = await prisma.inventoryLine.update({
    where: { id: lineId },
    data: {
      countedQty: data.countedQty,
      countedByUserId: userId,
      countedAt: new Date(),
    },
    include: {
      location: { select: { id: true, barcode: true } },
      product: { select: { id: true, sku: true, name: true, imageUrl: true, priceBrutto: true } },
      countedBy: { select: { id: true, name: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'INV_LINE',
      productId: line.productId,
      fromLocationId: line.locationId,
      qty: data.countedQty,
      metadata: {
        inventoryId,
        lineId,
        systemQty: line.systemQty,
        countedQty: data.countedQty,
        difference: data.countedQty - line.systemQty,
        updated: true,
      },
    },
  });

  return {
    ...updatedLine,
    systemQty: line.systemQty,
    difference: data.countedQty - line.systemQty,
  };
};

export const deleteInventoryLine = async (
  userId: string,
  inventoryId: string,
  lineId: string
) => {
  const inventoryCount = await prisma.inventoryCount.findUnique({
    where: { id: inventoryId },
  });

  if (!inventoryCount) {
    throw new AppError('Inwentaryzacja nie istnieje', 404);
  }

  if (inventoryCount.status !== 'IN_PROGRESS') {
    throw new AppError('Inwentaryzacja nie jest w trakcie', 400);
  }

  const line = await prisma.inventoryLine.findUnique({
    where: { id: lineId },
    include: {
      product: { select: { sku: true } },
      location: { select: { barcode: true } },
    },
  });

  if (!line || line.inventoryCountId !== inventoryId) {
    throw new AppError('Linia nie istnieje', 404);
  }

  await prisma.inventoryLine.delete({
    where: { id: lineId },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'INV_LINE',
      productId: line.productId,
      fromLocationId: line.locationId,
      qty: 0,
      metadata: {
        inventoryId,
        lineId,
        deleted: true,
        productSku: line.product.sku,
        locationBarcode: line.location.barcode,
      },
    },
  });
};

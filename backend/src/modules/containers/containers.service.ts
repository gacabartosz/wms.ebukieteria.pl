import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { paginationHelper, formatPagination } from '../../utils/helpers.js';

// Validate container barcode format (K followed by 6 digits)
const validateContainerBarcode = (barcode: string): boolean => {
  return /^K\d{6}$/.test(barcode);
};

// Generate next container barcode
const generateNextBarcode = async (): Promise<string> => {
  const lastContainer = await prisma.container.findFirst({
    where: {
      barcode: { startsWith: 'K' },
    },
    orderBy: { barcode: 'desc' },
  });

  if (!lastContainer) {
    return 'K000001';
  }

  const lastNumber = parseInt(lastContainer.barcode.substring(1));
  const nextNumber = lastNumber + 1;
  return `K${nextNumber.toString().padStart(6, '0')}`;
};

export const getContainers = async (params: {
  page?: number;
  limit?: number;
  locationId?: string;
  search?: string;
  unassigned?: boolean;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = { isActive: true };

  if (params.locationId) {
    where.locationId = params.locationId;
  }

  if (params.unassigned) {
    where.locationId = null;
  }

  if (params.search) {
    where.OR = [
      { barcode: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [containers, total] = await Promise.all([
    prisma.container.findMany({
      where,
      skip,
      take,
      include: {
        location: { select: { id: true, barcode: true, zone: true } },
        _count: { select: { stocks: true } },
      },
      orderBy: { barcode: 'asc' },
    }),
    prisma.container.count({ where }),
  ]);

  return {
    data: containers.map((c) => ({
      id: c.id,
      barcode: c.barcode,
      name: c.name,
      location: c.location,
      stockCount: c._count.stocks,
      createdAt: c.createdAt,
    })),
    pagination: formatPagination(page, limit, total),
  };
};

export const getContainerById = async (id: string) => {
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, barcode: true, zone: true, warehouse: { select: { id: true, code: true } } } },
      stocks: {
        include: {
          product: { select: { id: true, sku: true, name: true, ean: true, imageUrl: true } },
        },
      },
    },
  });

  if (!container) {
    throw new AppError('Kuweta nie istnieje', 404, 'CONTAINER_NOT_FOUND');
  }

  return {
    ...container,
    totalQty: container.stocks.reduce((sum, s) => sum + s.qty, 0),
  };
};

export const getContainerByBarcode = async (barcode: string) => {
  const container = await prisma.container.findUnique({
    where: { barcode: barcode.toUpperCase() },
    include: {
      location: { select: { id: true, barcode: true, zone: true } },
      _count: { select: { stocks: true } },
    },
  });

  if (!container) {
    throw new AppError('Kuweta nie istnieje', 404, 'CONTAINER_NOT_FOUND');
  }

  return container;
};

export const createContainer = async (data: {
  barcode?: string;
  name?: string;
  locationBarcode?: string;
}, userId: string) => {
  let barcode: string;

  if (data.barcode) {
    barcode = data.barcode.toUpperCase();
    if (!validateContainerBarcode(barcode)) {
      throw new AppError(
        'Nieprawidłowy format kodu kuwety',
        400,
        'INVALID_BARCODE_FORMAT',
        { barcode: 'Oczekiwano formatu: K000000 (np. K000001)' }
      );
    }

    const existing = await prisma.container.findUnique({
      where: { barcode },
    });

    if (existing) {
      throw new AppError('Kuweta o tym kodzie już istnieje', 400, 'DUPLICATE_BARCODE');
    }
  } else {
    barcode = await generateNextBarcode();
  }

  let locationId: string | null = null;

  if (data.locationBarcode) {
    const location = await prisma.location.findUnique({
      where: { barcode: data.locationBarcode.toUpperCase() },
    });

    if (!location) {
      throw new AppError('Lokalizacja nie istnieje', 404, 'LOCATION_NOT_FOUND');
    }

    locationId = location.id;
  }

  const container = await prisma.container.create({
    data: {
      barcode,
      name: data.name,
      locationId,
    },
    include: {
      location: { select: { id: true, barcode: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'CONTAINER_CREATE',
      metadata: { containerId: container.id, barcode: container.barcode },
    },
  });

  return container;
};

export const moveContainer = async (
  id: string,
  data: { locationBarcode: string },
  userId: string
) => {
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      location: { select: { barcode: true } },
    },
  });

  if (!container) {
    throw new AppError('Kuweta nie istnieje', 404, 'CONTAINER_NOT_FOUND');
  }

  const newLocation = await prisma.location.findUnique({
    where: { barcode: data.locationBarcode.toUpperCase() },
  });

  if (!newLocation) {
    throw new AppError('Docelowa lokalizacja nie istnieje', 404, 'LOCATION_NOT_FOUND');
  }

  const oldLocationBarcode = container.location?.barcode;

  // Update container location
  const updatedContainer = await prisma.container.update({
    where: { id },
    data: { locationId: newLocation.id },
    include: {
      location: { select: { id: true, barcode: true } },
    },
  });

  // Update all stock records in this container to new location
  await prisma.stock.updateMany({
    where: { containerId: id },
    data: { locationId: newLocation.id },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'CONTAINER_MOVE',
      metadata: {
        containerId: container.id,
        barcode: container.barcode,
        fromLocation: oldLocationBarcode,
        toLocation: newLocation.barcode,
      },
    },
  });

  return updatedContainer;
};

export const getContainerContents = async (id: string) => {
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      stocks: {
        where: { qty: { gt: 0 } },
        include: {
          product: { select: { id: true, sku: true, name: true, ean: true, imageUrl: true } },
        },
        orderBy: { product: { sku: 'asc' } },
      },
    },
  });

  if (!container) {
    throw new AppError('Kuweta nie istnieje', 404, 'CONTAINER_NOT_FOUND');
  }

  return {
    containerId: container.id,
    barcode: container.barcode,
    items: container.stocks.map((s) => ({
      productId: s.productId,
      sku: s.product.sku,
      name: s.product.name,
      ean: s.product.ean,
      imageUrl: s.product.imageUrl,
      qty: s.qty,
    })),
    totalQty: container.stocks.reduce((sum, s) => sum + s.qty, 0),
    uniqueProducts: container.stocks.length,
  };
};

export const updateContainer = async (id: string, data: { name?: string }) => {
  const existing = await prisma.container.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Kuweta nie istnieje', 404, 'CONTAINER_NOT_FOUND');
  }

  const container = await prisma.container.update({
    where: { id },
    data,
    include: {
      location: { select: { id: true, barcode: true } },
    },
  });

  return container;
};

export const deactivateContainer = async (id: string) => {
  const container = await prisma.container.findUnique({
    where: { id },
    include: {
      _count: { select: { stocks: true } },
    },
  });

  if (!container) {
    throw new AppError('Kuweta nie istnieje', 404, 'CONTAINER_NOT_FOUND');
  }

  // Check if container has stock
  const hasStock = await prisma.stock.findFirst({
    where: { containerId: id, qty: { gt: 0 } },
  });

  if (hasStock) {
    throw new AppError('Nie można dezaktywować kuwety z produktami', 400, 'CONTAINER_NOT_EMPTY');
  }

  await prisma.container.update({
    where: { id },
    data: { isActive: false },
  });

  return { message: 'Kuweta została dezaktywowana' };
};

// Bulk create containers
export const bulkCreateContainers = async (count: number, userId: string) => {
  const containers = [];

  for (let i = 0; i < count; i++) {
    const barcode = await generateNextBarcode();
    const container = await prisma.container.create({
      data: { barcode },
    });
    containers.push(container);
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'CONTAINER_CREATE',
      metadata: {
        bulk: true,
        count,
        barcodes: containers.map(c => c.barcode),
      },
    },
  });

  return containers;
};

export const getAllContainersForExport = async () => {
  return prisma.container.findMany({
    include: {
      location: { select: { barcode: true } },
      _count: { select: { stocks: true } },
    },
    orderBy: { barcode: 'asc' },
  });
};

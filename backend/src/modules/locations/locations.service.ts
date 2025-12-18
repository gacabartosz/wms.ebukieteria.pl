import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { parseLocationBarcode, validateLocationBarcode, paginationHelper, formatPagination } from '../../utils/helpers.js';

export const getLocations = async (params: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  status?: string;
  search?: string;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = { isActive: true };

  if (params.warehouseId) {
    where.warehouseId = params.warehouseId;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.search) {
    where.OR = [
      { barcode: { contains: params.search, mode: 'insensitive' } },
      { zone: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where,
      skip,
      take,
      include: {
        warehouse: { select: { id: true, code: true } },
        _count: { select: { stocks: true } },
      },
      orderBy: { barcode: 'asc' },
    }),
    prisma.location.count({ where }),
  ]);

  return {
    data: locations.map((l) => ({
      id: l.id,
      barcode: l.barcode,
      warehouse: l.warehouse,
      rack: l.rack,
      shelf: l.shelf,
      level: l.level,
      zone: l.zone,
      status: l.status,
      stockCount: l._count.stocks,
    })),
    pagination: formatPagination(page, limit, total),
  };
};

export const getLocationById = async (id: string) => {
  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      stocks: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  if (!location) {
    throw new AppError('Lokalizacja nie istnieje', 404);
  }

  return location;
};

export const getLocationByBarcode = async (barcode: string) => {
  const location = await prisma.location.findUnique({
    where: { barcode: barcode.toUpperCase() },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  if (!location) {
    throw new AppError('Lokalizacja nie istnieje', 404, 'LOCATION_NOT_FOUND');
  }

  return location;
};

export const createLocation = async (data: {
  barcode: string;
  warehouseId?: string;
  zone?: string;
}) => {
  const barcode = data.barcode.toUpperCase();

  if (!validateLocationBarcode(barcode)) {
    throw new AppError(
      'Nieprawidłowy format kodu lokalizacji',
      400,
      'INVALID_BARCODE_FORMAT',
      { barcode: 'Oczekiwano formatu: MAGAZYN-RR-SS-PP (np. PL1-24-12-03)' }
    );
  }

  const parsed = parseLocationBarcode(barcode);
  if (!parsed) {
    throw new AppError('Nie można sparsować kodu lokalizacji', 400);
  }

  // Check if warehouse exists or get/create it
  let warehouse;
  if (data.warehouseId) {
    warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });
  } else {
    warehouse = await prisma.warehouse.findUnique({
      where: { code: parsed.warehouse },
    });
  }

  if (!warehouse) {
    throw new AppError(`Magazyn ${parsed.warehouse} nie istnieje`, 400, 'WAREHOUSE_NOT_FOUND');
  }

  const existing = await prisma.location.findUnique({
    where: { barcode },
  });

  if (existing) {
    throw new AppError('Lokalizacja o tym kodzie już istnieje', 400, 'DUPLICATE_BARCODE');
  }

  const location = await prisma.location.create({
    data: {
      barcode,
      warehouseId: warehouse.id,
      rack: parsed.rack,
      shelf: parsed.shelf,
      level: parsed.level,
      zone: data.zone,
    },
    include: {
      warehouse: { select: { id: true, code: true } },
    },
  });

  return location;
};

export const updateLocation = async (id: string, data: { zone?: string }) => {
  const existing = await prisma.location.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Lokalizacja nie istnieje', 404);
  }

  const location = await prisma.location.update({
    where: { id },
    data,
  });

  return location;
};

export const updateLocationStatus = async (
  id: string,
  data: { status: 'ACTIVE' | 'BLOCKED' | 'COUNTING'; blockReason?: string }
) => {
  const existing = await prisma.location.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Lokalizacja nie istnieje', 404);
  }

  const location = await prisma.location.update({
    where: { id },
    data: {
      status: data.status,
      blockReason: data.status === 'BLOCKED' ? data.blockReason : null,
    },
  });

  return location;
};

export const deactivateLocation = async (id: string) => {
  const existing = await prisma.location.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Lokalizacja nie istnieje', 404);
  }

  await prisma.location.update({
    where: { id },
    data: { isActive: false },
  });

  return { message: 'Lokalizacja została dezaktywowana' };
};

export const getAllLocationsForExport = async () => {
  return prisma.location.findMany({
    where: { isActive: true },
    include: {
      warehouse: { select: { code: true } },
    },
    orderBy: { barcode: 'asc' },
  });
};

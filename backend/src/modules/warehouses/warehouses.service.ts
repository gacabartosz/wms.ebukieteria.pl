import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';

export const getWarehouses = async () => {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { locations: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  return {
    data: warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      isActive: w.isActive,
      isDefault: w.isDefault,
      locationsCount: w._count.locations,
    })),
  };
};

export const getWarehouseById = async (id: string) => {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      _count: {
        select: { locations: true },
      },
    },
  });

  if (!warehouse) {
    throw new AppError('Magazyn nie istnieje', 404);
  }

  return warehouse;
};

export const createWarehouse = async (data: {
  code: string;
  name: string;
  address?: string;
  isDefault?: boolean;
}) => {
  const existing = await prisma.warehouse.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw new AppError('Magazyn o tym kodzie już istnieje', 400);
  }

  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      code: data.code.toUpperCase(),
      name: data.name,
      address: data.address,
      isDefault: data.isDefault || false,
    },
  });

  return warehouse;
};

export const updateWarehouse = async (
  id: string,
  data: { name?: string; address?: string; isDefault?: boolean }
) => {
  const existing = await prisma.warehouse.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Magazyn nie istnieje', 404);
  }

  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data,
  });

  return warehouse;
};

export const deactivateWarehouse = async (id: string) => {
  const existing = await prisma.warehouse.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Magazyn nie istnieje', 404);
  }

  await prisma.warehouse.update({
    where: { id },
    data: { isActive: false },
  });

  return { message: 'Magazyn został dezaktywowany' };
};

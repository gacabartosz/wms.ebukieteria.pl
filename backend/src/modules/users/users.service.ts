import bcrypt from 'bcryptjs';
import prisma from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { sanitizePhone, paginationHelper, formatPagination } from '../../utils/helpers.js';
import type { CreateUserInput, UpdateUserInput } from './users.validation.js';

export const getUsers = async (params: {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
  isActive?: boolean;
}) => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const { skip, take } = paginationHelper(page, limit);

  const where: any = {};

  if (params.role) {
    where.role = params.role;
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        username: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        assignedWarehouses: {
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  // Przekształć dane do prostszej struktury
  const usersWithWarehouses = users.map(user => ({
    ...user,
    warehouses: user.assignedWarehouses.map(uw => uw.warehouse),
    assignedWarehouses: undefined,
  }));

  return {
    data: usersWithWarehouses,
    pagination: formatPagination(page, limit, total),
  };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      phone: true,
      name: true,
      role: true,
      permissions: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      assignedWarehouses: {
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  // Przekształć assignedWarehouses na prostszą strukturę
  return {
    ...user,
    warehouses: user.assignedWarehouses.map(uw => uw.warehouse),
    assignedWarehouses: undefined,
  };
};

export const createUser = async (data: CreateUserInput) => {
  const phone = sanitizePhone(data.phone);

  const existing = await prisma.user.findUnique({
    where: { phone },
  });

  if (existing) {
    throw new AppError('Użytkownik z tym numerem telefonu już istnieje', 400);
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      phone,
      password: hashedPassword,
      name: data.name,
      role: data.role || 'WAREHOUSE',
      permissions: data.permissions || [],
    },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
    },
  });

  return user;
};

export const updateUser = async (id: string, data: UpdateUserInput) => {
  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      permissions: true,
      isActive: true,
    },
  });

  return user;
};

export const resetPassword = async (id: string, newPassword: string) => {
  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id },
    data: {
      password: hashedPassword,
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  return { message: 'Hasło zostało zresetowane' };
};

export const deactivateUser = async (id: string) => {
  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return { message: 'Użytkownik został dezaktywowany' };
};

// ============================================
// WAREHOUSE ASSIGNMENT FUNCTIONS
// ============================================

// Pobierz magazyny przypisane do użytkownika
export const getUserWarehouses = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      assignedWarehouses: {
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  return user.assignedWarehouses.map(uw => uw.warehouse);
};

// Przypisz użytkownika do magazynu (Admin only)
export const assignWarehouse = async (userId: string, warehouseId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new AppError('Magazyn nie istnieje', 404);
  }

  // Sprawdź czy już przypisany
  const existing = await prisma.userWarehouse.findUnique({
    where: {
      userId_warehouseId: { userId, warehouseId },
    },
  });

  if (existing) {
    throw new AppError('Użytkownik jest już przypisany do tego magazynu', 400);
  }

  await prisma.userWarehouse.create({
    data: { userId, warehouseId },
  });

  return { message: 'Użytkownik przypisany do magazynu' };
};

// Usuń użytkownika z magazynu (Admin only)
export const unassignWarehouse = async (userId: string, warehouseId: string) => {
  const existing = await prisma.userWarehouse.findUnique({
    where: {
      userId_warehouseId: { userId, warehouseId },
    },
  });

  if (!existing) {
    throw new AppError('Użytkownik nie jest przypisany do tego magazynu', 404);
  }

  await prisma.userWarehouse.delete({
    where: {
      userId_warehouseId: { userId, warehouseId },
    },
  });

  return { message: 'Użytkownik usunięty z magazynu' };
};

// Pobierz użytkowników przypisanych do magazynu
export const getWarehouseUsers = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    include: {
      assignedUsers: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!warehouse) {
    throw new AppError('Magazyn nie istnieje', 404);
  }

  return warehouse.assignedUsers.map(uw => uw.user);
};

// Zaktualizuj przypisania magazynów dla użytkownika (nadpisz wszystkie)
export const updateUserWarehouses = async (userId: string, warehouseIds: string[]) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  // Usuń wszystkie obecne przypisania
  await prisma.userWarehouse.deleteMany({
    where: { userId },
  });

  // Dodaj nowe przypisania
  if (warehouseIds.length > 0) {
    await prisma.userWarehouse.createMany({
      data: warehouseIds.map(warehouseId => ({
        userId,
        warehouseId,
      })),
    });
  }

  return { message: 'Przypisania magazynów zaktualizowane' };
};

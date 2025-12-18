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
        phone: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    pagination: formatPagination(page, limit, total),
  };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      permissions: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  return user;
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

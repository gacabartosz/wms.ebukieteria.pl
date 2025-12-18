import bcrypt from 'bcryptjs';
import prisma from '../../config/database.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../../config/jwt.js';
import { AppError } from '../../middleware/errorHandler.js';
import { MAX_LOGIN_ATTEMPTS, LOCK_TIME_MINUTES } from '../../utils/constants.js';
import { sanitizePhone } from '../../utils/helpers.js';

export const login = async (phone: string, password: string) => {
  const sanitizedPhone = sanitizePhone(phone);

  const user = await prisma.user.findUnique({
    where: { phone: sanitizedPhone },
  });

  if (!user) {
    throw new AppError('Nieprawidłowy numer telefonu lub hasło', 401);
  }

  if (!user.isActive) {
    throw new AppError('Konto nieaktywne. Skontaktuj się z administratorem.', 403);
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(`Konto zablokowane. Spróbuj za ${remainingMinutes} minut.`, 423, 'ACCOUNT_LOCKED', {
      lockedUntil: user.lockedUntil,
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // Increment failed login attempts
    const newFailedLogins = user.failedLogins + 1;
    const updateData: { failedLogins: number; lockedUntil?: Date } = {
      failedLogins: newFailedLogins,
    };

    if (newFailedLogins >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    throw new AppError('Nieprawidłowy numer telefonu lub hasło', 401);
  }

  // Reset failed login attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLogins: 0,
      lockedUntil: null,
      lastLogin: new Date(),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'USER_LOGIN',
      metadata: {
        timestamp: new Date().toISOString(),
      },
    },
  });

  const payload: TokenPayload = {
    userId: user.id,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    },
  };
};

export const refresh = async (refreshToken: string) => {
  try {
    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      throw new AppError('Użytkownik nieaktywny lub nie istnieje', 401);
    }

    const newPayload: TokenPayload = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
    };

    const accessToken = generateAccessToken(newPayload);

    return { accessToken };
  } catch (error) {
    throw new AppError('Token odświeżający nieważny lub wygasł', 401);
  }
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw new AppError('Aktualne hasło jest nieprawidłowe', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePw: false,
    },
  });

  return { message: 'Hasło zostało zmienione' };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      permissions: true,
    },
  });

  if (!user) {
    throw new AppError('Użytkownik nie istnieje', 404);
  }

  return user;
};

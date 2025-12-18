import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../config/jwt.js';
import prisma from '../config/database.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload & { id: string };
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Brak tokenu autoryzacji' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Użytkownik nieaktywny lub nie istnieje' });
      return;
    }

    req.user = { ...payload, id: payload.userId };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token nieważny lub wygasł' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Brak autoryzacji' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Brak uprawnień do tej operacji' });
      return;
    }

    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Brak autoryzacji' });
      return;
    }

    const hasPermission = permissions.some(p => req.user!.permissions.includes(p));
    const isAdmin = req.user.role === 'ADMIN';

    if (!hasPermission && !isAdmin) {
      res.status(403).json({ error: 'Brak wymaganych uprawnień' });
      return;
    }

    next();
  };
};

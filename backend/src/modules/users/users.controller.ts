import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service.js';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, role, search, isActive } = req.query;
    const result = await usersService.getUsers({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      role: role as string,
      search: search as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.getUserById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.createUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.updateUser(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.resetPassword(req.params.id, req.body.newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersService.deactivateUser(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

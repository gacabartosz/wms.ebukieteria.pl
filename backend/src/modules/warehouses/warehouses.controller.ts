import { Request, Response, NextFunction } from 'express';
import * as warehousesService from './warehouses.service.js';

export const getWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.getWarehouses();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getWarehouseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.getWarehouseById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.createWarehouse(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.updateWarehouse(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await warehousesService.deactivateWarehouse(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

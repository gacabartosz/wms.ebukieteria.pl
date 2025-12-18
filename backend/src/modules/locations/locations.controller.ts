import { Request, Response, NextFunction } from 'express';
import * as locationsService from './locations.service.js';
import { exportToExcel } from '../../utils/excelExport.js';

export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, warehouseId, status, search } = req.query;
    const result = await locationsService.getLocations({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      warehouseId: warehouseId as string,
      status: status as string,
      search: search as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getLocationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await locationsService.getLocationById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getLocationByBarcode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await locationsService.getLocationByBarcode(req.params.barcode);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await locationsService.createLocation(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await locationsService.updateLocation(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateLocationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await locationsService.updateLocationStatus(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await locationsService.deactivateLocation(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const exportLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locations = await locationsService.getAllLocationsForExport();

    const columns = [
      { header: 'Kod', key: 'barcode', width: 20 },
      { header: 'Magazyn', key: 'warehouse', width: 15 },
      { header: 'Strefa', key: 'zone', width: 10 },
      { header: 'Regał', key: 'rack', width: 10 },
      { header: 'Półka', key: 'shelf', width: 10 },
      { header: 'Poziom', key: 'level', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Data utworzenia', key: 'createdAt', width: 20 },
    ];

    const data = locations.map((l) => ({
      barcode: l.barcode,
      warehouse: l.warehouse?.code || '',
      zone: l.zone || '',
      rack: l.rack || '',
      shelf: l.shelf || '',
      level: l.level || '',
      status: l.status,
      createdAt: l.createdAt.toISOString().split('T')[0],
    }));

    await exportToExcel(res, 'lokalizacje', 'Lokalizacje', columns, data);
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from 'express';
import * as containersService from './containers.service.js';
import { exportToExcel } from '../../utils/excelExport.js';

export const getContainers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, locationId, search, unassigned } = req.query;
    const result = await containersService.getContainers({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      locationId: locationId as string,
      search: search as string,
      unassigned: unassigned === 'true',
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getContainerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containersService.getContainerById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getContainerByBarcode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containersService.getContainerByBarcode(req.params.barcode);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createContainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const result = await containersService.createContainer(req.body, userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const moveContainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const result = await containersService.moveContainer(req.params.id, req.body, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getContainerContents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await containersService.getContainerContents(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateContainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const result = await containersService.updateContainer(req.params.id, req.body, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateContainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const result = await containersService.deactivateContainer(req.params.id, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const bulkCreateContainers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { count } = req.body;
    if (!count || count < 1 || count > 100) {
      res.status(400).json({ error: 'Count musi być między 1 a 100' });
      return;
    }
    const result = await containersService.bulkCreateContainers(count, userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const exportContainers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const containers = await containersService.getAllContainersForExport();

    const columns = [
      { header: 'Kod', key: 'barcode', width: 15 },
      { header: 'Nazwa', key: 'name', width: 25 },
      { header: 'Lokalizacja', key: 'location', width: 20 },
      { header: 'Ilość produktów', key: 'stockCount', width: 15 },
      { header: 'Aktywna', key: 'isActive', width: 10 },
      { header: 'Data utworzenia', key: 'createdAt', width: 20 },
    ];

    const data = containers.map((c) => ({
      barcode: c.barcode,
      name: c.name || '',
      location: c.location?.barcode || '(brak)',
      stockCount: c._count.stocks,
      isActive: c.isActive ? 'Tak' : 'Nie',
      createdAt: c.createdAt.toISOString().split('T')[0],
    }));

    await exportToExcel(res, 'kuwety', 'Kuwety', columns, data);
  } catch (error) {
    next(error);
  }
};

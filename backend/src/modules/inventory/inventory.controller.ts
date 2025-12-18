import { Request, Response, NextFunction } from 'express';
import * as inventoryService from './inventory.service.js';
import { z } from 'zod';
import { exportInventoryToExcel } from '../../utils/excelExport.js';

const createInventorySchema = z.object({
  name: z.string().min(1),
  warehouseId: z.string().uuid(),
  locationIds: z.array(z.string().uuid()).optional(),
});

const addLineSchema = z.object({
  locationBarcode: z.string().min(1),
  productCode: z.string().min(1),
  countedQty: z.number().int().min(0),
});

const updateInventorySchema = z.object({
  name: z.string().min(1).optional(),
});

export const getInventoryCounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, warehouseId } = req.query;
    const result = await inventoryService.getInventoryCounts({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string,
      warehouseId: warehouseId as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getInventoryCountById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inventoryCount = await inventoryService.getInventoryCountById(req.params.id);
    res.json(inventoryCount);
  } catch (error) {
    next(error);
  }
};

export const createInventoryCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createInventorySchema.parse(req.body);
    const inventoryCount = await inventoryService.createInventoryCount(req.user!.id, data);
    res.status(201).json(inventoryCount);
  } catch (error) {
    next(error);
  }
};

export const addInventoryLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = addLineSchema.parse(req.body);
    const line = await inventoryService.addInventoryLine(req.user!.id, req.params.id, data);
    res.status(201).json(line);
  } catch (error) {
    next(error);
  }
};

export const completeInventoryCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.completeInventoryCount(req.user!.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const cancelInventoryCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inventoryService.cancelInventoryCount(req.user!.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateInventoryCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateInventorySchema.parse(req.body);
    const result = await inventoryService.updateInventoryCount(req.params.id, data);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteInventoryCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await inventoryService.deleteInventoryCount(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getLocationForCounting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationBarcode } = req.query;
    const result = await inventoryService.getLocationForCounting(
      req.params.id,
      locationBarcode as string
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const exportInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inventory = await inventoryService.getInventoryForExport(req.params.id);

    const inventoryData = {
      name: inventory.name,
      warehouse: inventory.warehouse?.name || inventory.warehouse?.code,
      status: inventory.status,
      createdAt: inventory.createdAt,
      completedAt: inventory.completedAt,
      lines: inventory.lines.map((l) => ({
        location: l.location?.barcode || '',
        sku: l.product?.sku || '',
        name: l.product?.name || '',
        systemQty: l.systemQty,
        countedQty: l.countedQty,
        difference: l.countedQty - l.systemQty,
        countedBy: l.countedBy?.name || '',
        countedAt: l.countedAt ? new Date(l.countedAt).toISOString().split('T')[0] : '',
      })),
    };

    const filename = `inwentaryzacja-${inventory.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await exportInventoryToExcel(res, filename, inventoryData);
  } catch (error) {
    next(error);
  }
};

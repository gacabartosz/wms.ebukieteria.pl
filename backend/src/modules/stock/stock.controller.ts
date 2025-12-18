import { Request, Response, NextFunction } from 'express';
import * as stockService from './stock.service.js';

export const getStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, productId, locationId, warehouseId, minQty, maxQty } = req.query;
    const result = await stockService.getStock({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      productId: productId as string,
      locationId: locationId as string,
      warehouseId: warehouseId as string,
      minQty: minQty ? parseInt(minQty as string) : undefined,
      maxQty: maxQty ? parseInt(maxQty as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getStockByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productCode, locationBarcode } = req.query;
    const result = await stockService.getStockByCode({
      productCode: productCode as string,
      locationBarcode: locationBarcode as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

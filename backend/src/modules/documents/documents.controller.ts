import { Request, Response, NextFunction } from 'express';
import * as documentsService from './documents.service.js';
import { z } from 'zod';

const createDocumentSchema = z.object({
  type: z.enum(['PZ', 'WZ', 'MM', 'INV_ADJ']),
  warehouseId: z.string().uuid(),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

const addLineSchema = z.object({
  productCode: z.string().min(1),
  fromLocationBarcode: z.string().optional(),
  toLocationBarcode: z.string().optional(),
  qty: z.number().int().positive(),
});

export const getDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, type, status, warehouseId, dateFrom, dateTo } = req.query;
    const result = await documentsService.getDocuments({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      type: type as string,
      status: status as string,
      warehouseId: warehouseId as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      createdById: req.query.createdById as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getDocumentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await documentsService.getDocumentById(req.params.id);
    res.json(document);
  } catch (error) {
    next(error);
  }
};

export const createDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createDocumentSchema.parse(req.body);
    const document = await documentsService.createDocument(req.user!.id, data);
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};

export const addDocumentLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = addLineSchema.parse(req.body);
    const line = await documentsService.addDocumentLine(req.user!.id, req.params.id, data);
    res.status(201).json(line);
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await documentsService.deleteDocumentLine(req.params.id, req.params.lineId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const confirmDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await documentsService.confirmDocument(req.user!.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const cancelDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await documentsService.cancelDocument(req.user!.id, req.params.id, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

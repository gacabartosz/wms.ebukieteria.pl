import { Request, Response, NextFunction } from 'express';
import * as auditService from './audit.service.js';

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page,
      limit,
      action,
      userId,
      productId,
      locationId,
      documentId,
      dateFrom,
      dateTo,
    } = req.query;

    const result = await auditService.getAuditLogs({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      action: action as string,
      userId: userId as string,
      productId: productId as string,
      locationId: locationId as string,
      documentId: documentId as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProductHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;
    const result = await auditService.getProductHistory(req.params.productId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getLocationHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;
    const result = await auditService.getLocationHistory(req.params.locationId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getDocumentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.getDocumentHistory(req.params.documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getAuditActions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = auditService.getAuditActions();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

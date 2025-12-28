import { Request, Response, NextFunction } from 'express';
import * as productsService from './products.service.js';
import { exportToExcel } from '../../utils/excelExport.js';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, owner, zone, category, isActive } = req.query;
    const result = await productsService.getProducts({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      owner: owner as string,
      zone: zone as string,
      category: category as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.getProductById(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProductByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.getProductByCode(req.params.code);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.createProduct(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.updateProduct(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Brak pliku' });
      return;
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    const result = await productsService.updateProductImage(req.params.id, imageUrl);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deactivateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productsService.deactivateProduct(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const searchAutocomplete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    const result = await productsService.searchProductsAutocomplete(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const exportProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await productsService.getAllProductsForExport();

    const columns = [
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'EAN', key: 'ean', width: 15 },
      { header: 'Nazwa', key: 'name', width: 35 },
      { header: 'Opis', key: 'description', width: 30 },
      { header: 'Magazyn', key: 'zone', width: 10 },
      { header: 'Kategoria', key: 'category', width: 12 },
      { header: 'J.m.', key: 'unit', width: 8 },
      { header: 'Cena netto', key: 'priceNetto', width: 12 },
      { header: 'Cena brutto', key: 'priceBrutto', width: 12 },
      { header: 'VAT %', key: 'vatRate', width: 8 },
      { header: 'Aktywny', key: 'isActive', width: 10 },
    ];

    const data = products.map((p) => ({
      sku: p.sku,
      ean: p.ean || '',
      name: p.name,
      description: p.description || '',
      zone: p.zone || '',
      category: p.category || '',
      unit: p.unit || 'szt',
      priceNetto: p.priceNetto ? Number(p.priceNetto) : '',
      priceBrutto: p.priceBrutto ? Number(p.priceBrutto) : '',
      vatRate: p.vatRate || '',
      isActive: p.isActive ? 'Tak' : 'Nie',
    }));

    await exportToExcel(res, 'produkty', 'Produkty', columns, data);
  } catch (error) {
    next(error);
  }
};

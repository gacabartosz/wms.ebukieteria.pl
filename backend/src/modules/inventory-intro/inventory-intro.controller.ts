import { Request, Response, NextFunction } from 'express';
import { inventoryIntroService } from './inventory-intro.service.js';

export const inventoryIntroController = {

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.create({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.getAll({
        warehouseId: req.query.warehouseId as string,
        status: req.query.status as string,
      });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.getById(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nie znaleziono' });
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async addLine(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.addLine(
        req.params.id,
        req.body,
        req.user!.id
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async updateLine(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.updateLine(
        req.params.id,
        req.params.lineId,
        req.body,
        req.user!.id
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async deleteLine(req: Request, res: Response, next: NextFunction) {
    try {
      await inventoryIntroService.deleteLine(req.params.id, req.params.lineId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.complete(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.cancel(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // UNCANCEL - Cofnij anulowanie (tylko ADMIN)
  async uncancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.uncancel(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // DELETE - Usuń całą inwentaryzację (tylko ADMIN)
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.delete(req.params.id, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.getSummary(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Nie znaleziono' });
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getDefaultWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.getDefaultWarehouse(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getUserWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryIntroService.getUserWarehouses(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // Export do Excel (tylko ADMIN)
  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const { inventoryIds, vatRate } = req.body;

      if (!inventoryIds || !Array.isArray(inventoryIds) || inventoryIds.length === 0) {
        return res.status(400).json({ error: 'Wybierz co najmniej jedną inwentaryzację' });
      }

      const workbook = await inventoryIntroService.exportToExcel(inventoryIds, vatRate || 23);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=inwentaryzacja_${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },

  // Export do CSV (tylko ADMIN)
  async exportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const { inventoryIds, vatRate } = req.body;

      if (!inventoryIds || !Array.isArray(inventoryIds) || inventoryIds.length === 0) {
        return res.status(400).json({ error: 'Wybierz co najmniej jedną inwentaryzację' });
      }

      const csv = await inventoryIntroService.exportToCSV(inventoryIds, vatRate || 23);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=inwentaryzacja_${Date.now()}.csv`);
      // BOM dla poprawnego kodowania w Excel
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  },

  // Export do PDF ze zdjęciami
  async exportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { inventoryIds, vatRate } = req.body;

      if (!inventoryIds || !Array.isArray(inventoryIds) || inventoryIds.length === 0) {
        return res.status(400).json({ error: 'Wybierz co najmniej jedną inwentaryzację' });
      }

      const doc = await inventoryIntroService.exportToPDF(inventoryIds, vatRate || 23);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=inwentaryzacja_${Date.now()}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error) {
      next(error);
    }
  },
};

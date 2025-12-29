import api from './api';
import type { InventoryCount, PaginatedResponse } from '../types';
import { downloadFile } from '../utils/download';

export interface InventoryDetail extends InventoryCount {
  lines: Array<{
    id: string;
    location: { id: string; barcode: string; zone: string };
    product: { id: string; sku: string; name: string; imageUrl?: string; ean?: string; priceBrutto?: number | null; priceNetto?: number | null };
    systemQty: number;
    countedQty: number;
    countedBy?: { id: string; name: string };
    countedAt?: string;
  }>;
}

export interface LocationForCounting {
  location: { id: string; barcode: string; zone: string };
  container?: { id: string; barcode: string; name?: string } | null;
  expectedProducts: Array<{
    product: { id: string; sku: string; name: string; imageUrl?: string; ean?: string };
    systemQty: number;
  }>;
  countedLines: Array<{
    product: { id: string; sku: string; name: string };
    systemQty: number;
    countedQty: number;
    difference: number;
  }>;
}

export const inventoryService = {
  getInventoryCounts: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    warehouseId?: string;
  }): Promise<PaginatedResponse<InventoryCount>> => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  getInventoryCountById: async (id: string): Promise<InventoryDetail> => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  createInventoryCount: async (data: {
    name: string;
    warehouseId: string;
    locationIds?: string[];
  }): Promise<InventoryCount> => {
    const response = await api.post('/inventory', data);
    return response.data;
  },

  getLocationForCounting: async (inventoryId: string, locationBarcode: string): Promise<LocationForCounting> => {
    const response = await api.get(`/inventory/${inventoryId}/location`, {
      params: { locationBarcode },
    });
    return response.data;
  },

  addLine: async (
    inventoryId: string,
    data: {
      locationBarcode: string;
      productCode: string;
      countedQty: number;
    }
  ): Promise<any> => {
    const response = await api.post(`/inventory/${inventoryId}/lines`, data);
    return response.data;
  },

  completeInventoryCount: async (id: string): Promise<{ adjustments: any[]; adjustmentsCount: number }> => {
    const response = await api.post(`/inventory/${id}/complete`);
    return response.data;
  },

  cancelInventoryCount: async (id: string): Promise<void> => {
    await api.post(`/inventory/${id}/cancel`);
  },

  updateInventoryCount: async (id: string, data: { name: string }): Promise<InventoryCount> => {
    const response = await api.put(`/inventory/${id}`, data);
    return response.data;
  },

  deleteInventoryCount: async (id: string): Promise<void> => {
    await api.delete(`/inventory/${id}`);
  },

  exportToExcel: async (id: string, name: string): Promise<void> => {
    const filename = `inwentaryzacja-${name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    await downloadFile(`/inventory/${id}/export`, filename);
  },

  updateLine: async (
    inventoryId: string,
    lineId: string,
    data: { countedQty: number }
  ): Promise<any> => {
    const response = await api.put(`/inventory/${inventoryId}/lines/${lineId}`, data);
    return response.data;
  },

  deleteLine: async (inventoryId: string, lineId: string): Promise<void> => {
    await api.delete(`/inventory/${inventoryId}/lines/${lineId}`);
  },
};

import api from './api';

export interface InventoryIntroLine {
  id: string;
  imageUrl: string;
  priceBrutto: number;
  quantity: number;
  unit: string;
  ean?: string;
  tempSku: string;
  tempName: string;
  productId?: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface InventoryIntro {
  id: string;
  number: string;
  name: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  defaultLocationBarcode: string;
  createdBy: { id: string; name: string };
  lines: InventoryIntroLine[];
  createdAt: string;
  completedAt?: string;
  _count?: { lines: number };
}

export interface InventoryIntroSummary extends InventoryIntro {
  summary: {
    productsCount: number;
    totalQuantity: number;
    totalValue: string;
    withImages: number;
    withEan: number;
  };
}

export interface DefaultWarehouse {
  id: string;
  code: string;
  name: string;
}

export const inventoryIntroService = {

  create: async (data: {
    name: string;
    warehouseId: string;
    defaultLocationBarcode: string;
  }): Promise<InventoryIntro> => {
    const response = await api.post('/inventory-intro', data);
    return response.data;
  },

  getAll: async (params?: {
    warehouseId?: string;
    status?: string;
  }): Promise<{ data: InventoryIntro[] }> => {
    const response = await api.get('/inventory-intro', { params });
    return response.data;
  },

  getById: async (id: string): Promise<InventoryIntro> => {
    const response = await api.get(`/inventory-intro/${id}`);
    return response.data;
  },

  getSummary: async (id: string): Promise<InventoryIntroSummary> => {
    const response = await api.get(`/inventory-intro/${id}/summary`);
    return response.data;
  },

  addLine: async (
    id: string,
    data: {
      imageUrl: string;
      priceBrutto: number;
      quantity: number;
      unit: string;
      ean?: string;
      name?: string;
    }
  ): Promise<InventoryIntroLine> => {
    const response = await api.post(`/inventory-intro/${id}/lines`, data);
    return response.data;
  },

  updateLine: async (
    id: string,
    lineId: string,
    data: {
      quantity?: number;
      priceBrutto?: number;
      name?: string;
      ean?: string;
    }
  ): Promise<InventoryIntroLine> => {
    const response = await api.patch(`/inventory-intro/${id}/lines/${lineId}`, data);
    return response.data;
  },

  deleteLine: async (id: string, lineId: string): Promise<void> => {
    await api.delete(`/inventory-intro/${id}/lines/${lineId}`);
  },

  complete: async (id: string): Promise<InventoryIntro> => {
    const response = await api.post(`/inventory-intro/${id}/complete`);
    return response.data;
  },

  cancel: async (id: string): Promise<InventoryIntro> => {
    const response = await api.post(`/inventory-intro/${id}/cancel`);
    return response.data;
  },

  // Cofnij anulowanie (ADMIN only)
  uncancel: async (id: string): Promise<InventoryIntro> => {
    const response = await api.post(`/inventory-intro/${id}/uncancel`);
    return response.data;
  },

  // Usuwanie inwentaryzacji (ADMIN only)
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/inventory-intro/${id}`);
    return response.data;
  },

  getDefaultWarehouse: async (): Promise<DefaultWarehouse> => {
    const response = await api.get('/inventory-intro/default-warehouse');
    return response.data;
  },

  // Export functions (ADMIN only)
  exportExcel: async (inventoryIds: string[], vatRate: number = 23): Promise<Blob> => {
    const response = await api.post(
      '/inventory-intro/export/excel',
      { inventoryIds, vatRate },
      { responseType: 'blob' }
    );
    return response.data;
  },

  exportCSV: async (inventoryIds: string[], vatRate: number = 23): Promise<Blob> => {
    const response = await api.post(
      '/inventory-intro/export/csv',
      { inventoryIds, vatRate },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

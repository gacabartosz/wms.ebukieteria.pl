import api from './api';
import type { Stock, Product, Location, PaginatedResponse } from '../types';

export interface StockByCodeResponse {
  product?: Product & { ean?: string };
  location?: Location;
  stocks?: Array<{ location: Location; qty: number }> | Array<{ product: Product; qty: number }>;
  stock?: { qty: number };
  totalQty?: number;
}

export const stockService = {
  getStock: async (params?: {
    page?: number;
    limit?: number;
    productId?: string;
    locationId?: string;
    warehouseId?: string;
  }): Promise<PaginatedResponse<Stock>> => {
    const response = await api.get('/stock', { params });
    return response.data;
  },

  getStockByCode: async (params: {
    productCode?: string;
    locationBarcode?: string;
  }): Promise<StockByCodeResponse> => {
    const response = await api.get('/stock/by-code', { params });
    return response.data;
  },
};

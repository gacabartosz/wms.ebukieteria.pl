import api from './api';
import type { Warehouse, PaginatedResponse } from '../types';

export const warehousesService = {
  getWarehouses: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Warehouse>> => {
    const response = await api.get('/warehouses', { params });
    return response.data;
  },

  getWarehouseById: async (id: string): Promise<Warehouse> => {
    const response = await api.get(`/warehouses/${id}`);
    return response.data;
  },

  createWarehouse: async (data: {
    code: string;
    name: string;
    address?: string;
  }): Promise<Warehouse> => {
    const response = await api.post('/warehouses', data);
    return response.data;
  },

  updateWarehouse: async (id: string, data: {
    name?: string;
    address?: string;
    isActive?: boolean;
  }): Promise<Warehouse> => {
    const response = await api.put(`/warehouses/${id}`, data);
    return response.data;
  },

  deleteWarehouse: async (id: string): Promise<void> => {
    await api.delete(`/warehouses/${id}`);
  },
};

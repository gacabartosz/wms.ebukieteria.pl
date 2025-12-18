import api from './api';
import type { Location, PaginatedResponse } from '../types';
import { downloadFile } from '../utils/download';

export const locationsService = {
  getLocations: async (params?: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    zone?: string;
    status?: string;
  }): Promise<PaginatedResponse<Location>> => {
    const response = await api.get('/locations', { params });
    return response.data;
  },

  getLocationById: async (id: string): Promise<Location> => {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  },

  createLocation: async (data: {
    barcode: string;
    warehouseId: string;
    zone?: string;
  }): Promise<Location> => {
    const response = await api.post('/locations', data);
    return response.data;
  },

  updateLocation: async (id: string, data: { status?: string }): Promise<Location> => {
    const response = await api.put(`/locations/${id}`, data);
    return response.data;
  },

  exportToExcel: async (): Promise<void> => {
    await downloadFile('/locations/export', 'lokalizacje.xlsx');
  },
};

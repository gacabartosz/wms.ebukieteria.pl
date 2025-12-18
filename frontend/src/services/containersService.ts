import api from './api';
import type { Container, ContainerDetail, PaginatedResponse } from '../types';
import { downloadFile } from '../utils/download';

export const containersService = {
  getContainers: async (params?: {
    page?: number;
    limit?: number;
    locationId?: string;
    search?: string;
    unassigned?: boolean;
  }): Promise<PaginatedResponse<Container>> => {
    const response = await api.get('/containers', { params });
    return response.data;
  },

  getContainerById: async (id: string): Promise<ContainerDetail> => {
    const response = await api.get(`/containers/${id}`);
    return response.data;
  },

  getContainerByBarcode: async (barcode: string): Promise<Container> => {
    const response = await api.get(`/containers/by-barcode/${barcode}`);
    return response.data;
  },

  createContainer: async (data: {
    barcode?: string;
    name?: string;
    locationBarcode?: string;
  }): Promise<Container> => {
    const response = await api.post('/containers', data);
    return response.data;
  },

  bulkCreateContainers: async (count: number): Promise<Container[]> => {
    const response = await api.post('/containers/bulk', { count });
    return response.data;
  },

  updateContainer: async (id: string, data: { name?: string }): Promise<Container> => {
    const response = await api.put(`/containers/${id}`, data);
    return response.data;
  },

  moveContainer: async (id: string, locationBarcode: string): Promise<Container> => {
    const response = await api.put(`/containers/${id}/move`, { locationBarcode });
    return response.data;
  },

  getContainerContents: async (id: string): Promise<{
    containerId: string;
    barcode: string;
    items: Array<{
      productId: string;
      sku: string;
      name: string;
      ean?: string;
      imageUrl?: string;
      qty: number;
    }>;
    totalQty: number;
    uniqueProducts: number;
  }> => {
    const response = await api.get(`/containers/${id}/contents`);
    return response.data;
  },

  deactivateContainer: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/containers/${id}`);
    return response.data;
  },

  exportToExcel: async (): Promise<void> => {
    await downloadFile('/containers/export', 'kuwety.xlsx');
  },
};

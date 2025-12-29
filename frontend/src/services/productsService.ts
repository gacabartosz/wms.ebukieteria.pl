import api from './api';
import type { Product, PaginatedResponse } from '../types';
import { downloadFile } from '../utils/download';

export const productsService = {
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Product>> => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getProductById: async (id: string): Promise<Product> => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  getProductBySku: async (sku: string): Promise<Product> => {
    const response = await api.get(`/products/sku/${sku}`);
    return response.data;
  },

  getProductByCode: async (code: string): Promise<Product> => {
    const response = await api.get(`/products/by-code/${code}`);
    return response.data;
  },

  createProduct: async (data: {
    sku: string;
    name: string;
    ean?: string;
    category?: string;
  }): Promise<Product> => {
    const response = await api.post('/products', data);
    return response.data;
  },

  updateProduct: async (id: string, data: {
    name?: string;
    ean?: string;
    category?: string;
    isActive?: boolean;
    priceNetto?: number | null;
    priceBrutto?: number | null;
  }): Promise<Product> => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  getCategories: async (): Promise<{ data: string[] }> => {
    const response = await api.get('/products/categories');
    return response.data;
  },

  exportToExcel: async (): Promise<void> => {
    await downloadFile('/products/export', 'produkty.xlsx');
  },

  // Autocomplete search - max 10 results
  searchAutocomplete: async (query: string): Promise<{ id: string; sku: string; ean: string | null; name: string }[]> => {
    if (!query || query.length < 2) return [];
    const response = await api.get('/products/search', { params: { q: query } });
    return response.data;
  },
};

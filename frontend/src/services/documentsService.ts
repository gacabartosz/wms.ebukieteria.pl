import api from './api';
import type { Document, DocumentDetail, DocumentLine, PaginatedResponse } from '../types';

export const documentsService = {
  getDocuments: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    warehouseId?: string;
  }): Promise<PaginatedResponse<Document>> => {
    const response = await api.get('/documents', { params });
    return response.data;
  },

  getDocumentById: async (id: string): Promise<DocumentDetail> => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  createDocument: async (data: {
    type: 'PZ' | 'WZ' | 'MM';
    warehouseId: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<Document> => {
    const response = await api.post('/documents', data);
    return response.data;
  },

  addLine: async (
    documentId: string,
    data: {
      productCode: string;
      fromLocationBarcode?: string;
      toLocationBarcode?: string;
      qty: number;
    }
  ): Promise<DocumentLine> => {
    const response = await api.post(`/documents/${documentId}/lines`, data);
    return response.data;
  },

  deleteLine: async (documentId: string, lineId: string): Promise<void> => {
    await api.delete(`/documents/${documentId}/lines/${lineId}`);
  },

  confirmDocument: async (id: string): Promise<Document> => {
    const response = await api.post(`/documents/${id}/confirm`);
    return response.data;
  },

  cancelDocument: async (id: string, reason?: string): Promise<void> => {
    await api.post(`/documents/${id}/cancel`, { reason });
  },
};

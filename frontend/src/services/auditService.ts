import api from './api';
import type { AuditLog, PaginatedResponse } from '../types';

export const auditService = {
  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    productId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<AuditLog>> => {
    const response = await api.get('/audit', { params });
    return response.data;
  },

  getActions: async (): Promise<{ data: Array<{ value: string; label: string }> }> => {
    const response = await api.get('/audit/actions');
    return response.data;
  },
};

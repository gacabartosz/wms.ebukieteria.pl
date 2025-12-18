import api from './api';
import type { User, PaginatedResponse } from '../types';

export const usersService = {
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<User>> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (data: {
    phone: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'WAREHOUSE';
  }): Promise<User> => {
    const response = await api.post('/users', data);
    return response.data;
  },

  updateUser: async (
    id: string,
    data: Partial<{
      name: string;
      role: string;
      isActive: boolean;
    }>
  ): Promise<User> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  resetPassword: async (id: string, newPassword: string): Promise<User> => {
    const response = await api.put(`/users/${id}/password`, { newPassword });
    return response.data;
  },

  deactivateUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

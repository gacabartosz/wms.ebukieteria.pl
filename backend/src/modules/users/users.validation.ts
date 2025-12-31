import { z } from 'zod';

export const createUserSchema = z.object({
  phone: z.string().min(1).max(50),  // Login/username (named 'phone' for frontend compatibility)
  password: z.string().min(4),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'WAREHOUSE']).optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'WAREHOUSE']).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

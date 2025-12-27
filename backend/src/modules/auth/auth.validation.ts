import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Login jest wymagany')
    .max(50, 'Login jest za długi'),
  password: z
    .string()
    .min(1, 'Hasło jest wymagane'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Token odświeżający jest wymagany'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktualne hasło jest wymagane'),
  newPassword: z.string().min(6, 'Nowe hasło musi mieć minimum 6 znaków'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

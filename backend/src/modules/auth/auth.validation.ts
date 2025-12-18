import { z } from 'zod';

export const loginSchema = z.object({
  phone: z
    .string()
    .min(9, 'Numer telefonu musi mieć minimum 9 znaków')
    .max(15, 'Numer telefonu jest za długi')
    .regex(/^\+?\d+$/, 'Numer telefonu może zawierać tylko cyfry i opcjonalnie + na początku'),
  password: z
    .string()
    .min(6, 'Hasło musi mieć minimum 6 znaków'),
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

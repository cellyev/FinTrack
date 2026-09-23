import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const signUpSchema = z.object({
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

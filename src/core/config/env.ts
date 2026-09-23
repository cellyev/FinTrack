import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .url('EXPO_PUBLIC_SUPABASE_URL must be a valid URL')
    .default('https://placeholder.supabase.co'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'EXPO_PUBLIC_SUPABASE_ANON_KEY cannot be empty')
    .default('placeholder-anon-key'),
  EXPO_PUBLIC_APP_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const formattedErrors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Environment validation failed: ${formattedErrors}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);

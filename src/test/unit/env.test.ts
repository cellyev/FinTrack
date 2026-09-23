import { parseEnv } from '@/core/config/env';

describe('Environment Config Validator', () => {
  it('should parse valid environment variables successfully', () => {
    const validEnv = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-12345',
      EXPO_PUBLIC_APP_ENV: 'production',
    };

    const parsed = parseEnv(validEnv);
    expect(parsed.EXPO_PUBLIC_SUPABASE_URL).toBe('https://test-project.supabase.co');
    expect(parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key-12345');
    expect(parsed.EXPO_PUBLIC_APP_ENV).toBe('production');
  });

  it('should fallback to defaults when environment is not set', () => {
    const emptyEnv = {};
    const parsed = parseEnv(emptyEnv);
    expect(parsed.EXPO_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
    expect(parsed.EXPO_PUBLIC_APP_ENV).toBe('development');
  });

  it('should reject invalid URL format for Supabase URL', () => {
    const invalidEnv = {
      EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
    };

    expect(() => parseEnv(invalidEnv)).toThrow('Environment validation failed');
  });
});

import { createClient } from '@supabase/supabase-js';
import { env } from '@/core/config/env';
import { SecureStoreAdapter } from '@/core/infrastructure/security/secure-store';

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: {
        getItem: (key) => SecureStoreAdapter.getItem(key),
        setItem: (key, value) => SecureStoreAdapter.setItem(key, value),
        removeItem: (key) => SecureStoreAdapter.removeItem(key),
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

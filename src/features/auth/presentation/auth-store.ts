import { create } from 'zustand';
import { AuthSession } from '../domain/auth-user';

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  setSession: (session: AuthSession | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  error: null,
  setSession: (session) => set({ session, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));

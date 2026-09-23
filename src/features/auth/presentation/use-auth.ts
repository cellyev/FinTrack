import { useCallback } from 'react';
import { useAuthStore } from './auth-store';
import { authRepository } from '../data/supabase-auth.repository';
import { SignInUseCase, SignUpUseCase, SignOutUseCase, GetSessionUseCase } from '../application/auth.usecases';
import { SignInInput, SignUpInput } from '../application/auth.dto';

const signInUseCase = new SignInUseCase(authRepository);
const signUpUseCase = new SignUpUseCase(authRepository);
const signOutUseCase = new SignOutUseCase(authRepository);
const getSessionUseCase = new GetSessionUseCase(authRepository);

export function useAuth() {
  const { session, isLoading, error, setSession, setLoading, setError } = useAuthStore();

  const restoreSession = useCallback(async () => {
    setLoading(true);
    const result = await getSessionUseCase.execute();
    if (result.success) {
      setSession(result.data);
    } else {
      setError(result.error.message);
    }
  }, [setSession, setLoading, setError]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      setLoading(true);
      setError(null);
      const result = await signInUseCase.execute(input);
      if (result.success) {
        setSession(result.data);
        return { success: true as const };
      } else {
        setError(result.error.message);
        return { success: false as const, error: result.error.message };
      }
    },
    [setSession, setLoading, setError]
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      setLoading(true);
      setError(null);
      const result = await signUpUseCase.execute(input);
      if (result.success) {
        setSession(result.data);
        return { success: true as const };
      } else {
        setError(result.error.message);
        return { success: false as const, error: result.error.message };
      }
    },
    [setSession, setLoading, setError]
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    const result = await signOutUseCase.execute();
    if (result.success) {
      setSession(null);
    } else {
      setError(result.error.message);
    }
  }, [setSession, setLoading, setError]);

  return {
    session,
    isAuthenticated: !!session?.user,
    user: session?.user ?? null,
    isLoading,
    error,
    clearError: () => setError(null),
    signIn,
    signUp,
    signOut,
    restoreSession,
  };
}

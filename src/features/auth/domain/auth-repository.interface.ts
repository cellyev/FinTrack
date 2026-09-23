import { Result, DomainError } from '@/core/domain/result';
import { AuthSession } from './auth-user';

export interface IAuthRepository {
  signIn(email: string, password: string): Promise<Result<AuthSession, DomainError>>;
  signUp(email: string, password: string, fullName?: string): Promise<Result<AuthSession, DomainError>>;
  signOut(): Promise<Result<void, DomainError>>;
  getSession(): Promise<Result<AuthSession | null, DomainError>>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
}

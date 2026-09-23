import { IAuthRepository } from '@/features/auth/domain/auth-repository.interface';
import { AuthSession } from '@/features/auth/domain/auth-user';
import { Result, ok, err, UnauthorizedError, DomainError } from '@/core/domain/result';

export class MockAuthRepository implements IAuthRepository {
  private currentSession: AuthSession | null = null;
  private listeners: ((session: AuthSession | null) => void)[] = [];
  public shouldFail: boolean = false;
  public failureMessage: string = 'Mock auth failure';

  public async signIn(email: string, _password: string): Promise<Result<AuthSession, DomainError>> {
    if (this.shouldFail) {
      return err(new UnauthorizedError(this.failureMessage));
    }
    const session: AuthSession = {
      user: {
        id: 'mock-user-id-123',
        email,
        createdAt: new Date().toISOString(),
      },
      accessToken: 'mock-access-token',
    };
    this.currentSession = session;
    this.notifyListeners();
    return ok(session);
  }

  public async signUp(
    email: string,
    _password: string,
    fullName?: string
  ): Promise<Result<AuthSession, DomainError>> {
    if (this.shouldFail) {
      return err(new UnauthorizedError(this.failureMessage));
    }
    const session: AuthSession = {
      user: {
        id: 'mock-user-id-123',
        email,
        fullName,
        createdAt: new Date().toISOString(),
      },
      accessToken: 'mock-access-token',
    };
    this.currentSession = session;
    this.notifyListeners();
    return ok(session);
  }

  public async signOut(): Promise<Result<void, DomainError>> {
    this.currentSession = null;
    this.notifyListeners();
    return ok(undefined);
  }

  public async getSession(): Promise<Result<AuthSession | null, DomainError>> {
    if (this.shouldFail) {
      return err(new UnauthorizedError(this.failureMessage));
    }
    return ok(this.currentSession);
  }

  public onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentSession));
  }
}

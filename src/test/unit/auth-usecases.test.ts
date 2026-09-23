import { MockAuthRepository } from '../mocks/mock-auth-repository';
import { SignInUseCase, SignUpUseCase, SignOutUseCase, GetSessionUseCase } from '@/features/auth/application/auth.usecases';

describe('Auth Application Use Cases', () => {
  let authRepository: MockAuthRepository;
  let signInUseCase: SignInUseCase;
  let signUpUseCase: SignUpUseCase;
  let signOutUseCase: SignOutUseCase;
  let getSessionUseCase: GetSessionUseCase;

  beforeEach(() => {
    authRepository = new MockAuthRepository();
    signInUseCase = new SignInUseCase(authRepository);
    signUpUseCase = new SignUpUseCase(authRepository);
    signOutUseCase = new SignOutUseCase(authRepository);
    getSessionUseCase = new GetSessionUseCase(authRepository);
  });

  describe('SignInUseCase', () => {
    it('should successfully sign in with valid credentials', async () => {
      const result = await signInUseCase.execute({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe('user@example.com');
      }
    });

    it('should reject invalid email format with ValidationError', async () => {
      const result = await signInUseCase.execute({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject short password with ValidationError', async () => {
      const result = await signInUseCase.execute({
        email: 'user@example.com',
        password: '123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('SignUpUseCase', () => {
    it('should successfully sign up with valid data', async () => {
      const result = await signUpUseCase.execute({
        email: 'newuser@example.com',
        password: 'securePassword123',
        fullName: 'Budi Pratama',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe('newuser@example.com');
        expect(result.data.user.fullName).toBe('Budi Pratama');
      }
    });
  });

  describe('SignOutUseCase & GetSessionUseCase', () => {
    it('should sign out and clear session', async () => {
      await signInUseCase.execute({
        email: 'user@example.com',
        password: 'password123',
      });

      let session = await getSessionUseCase.execute();
      expect(session.success).toBe(true);
      if (session.success) {
        expect(session.data).not.toBeNull();
      }

      await signOutUseCase.execute();
      session = await getSessionUseCase.execute();
      expect(session.success).toBe(true);
      if (session.success) {
        expect(session.data).toBeNull();
      }
    });
  });
});

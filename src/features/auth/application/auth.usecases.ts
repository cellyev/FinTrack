import { Result, err, ValidationError, DomainError } from '@/core/domain/result';
import { AuthSession } from '../domain/auth-user';
import { IAuthRepository } from '../domain/auth-repository.interface';
import { signInSchema, signUpSchema, SignInInput, SignUpInput } from './auth.dto';

export class SignInUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  public async execute(input: SignInInput): Promise<Result<AuthSession, DomainError>> {
    const parseResult = signInSchema.safeParse(input);
    if (!parseResult.success) {
      return err(new ValidationError(parseResult.error.errors[0]?.message ?? 'Validasi gagal'));
    }
    return this.authRepository.signIn(parseResult.data.email, parseResult.data.password);
  }
}

export class SignUpUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  public async execute(input: SignUpInput): Promise<Result<AuthSession, DomainError>> {
    const parseResult = signUpSchema.safeParse(input);
    if (!parseResult.success) {
      return err(new ValidationError(parseResult.error.errors[0]?.message ?? 'Validasi gagal'));
    }
    return this.authRepository.signUp(
      parseResult.data.email,
      parseResult.data.password,
      parseResult.data.fullName
    );
  }
}

export class SignOutUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  public async execute(): Promise<Result<void, DomainError>> {
    return this.authRepository.signOut();
  }
}

export class GetSessionUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  public async execute(): Promise<Result<AuthSession | null, DomainError>> {
    return this.authRepository.getSession();
  }
}

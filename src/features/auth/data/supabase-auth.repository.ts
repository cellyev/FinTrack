import { SupabaseClient, Session } from '@supabase/supabase-js';
import { Result, ok, err, UnauthorizedError, DatabaseError, DomainError } from '@/core/domain/result';
import { AuthSession } from '../domain/auth-user';
import { IAuthRepository } from '../domain/auth-repository.interface';
import { supabase as defaultSupabase } from '@/core/supabase/client';

function localizeAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
    return 'Email atau kata sandi salah. Silakan periksa kembali.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Silakan periksa kotak masuk atau spam email Anda.';
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Email sudah terdaftar. Silakan gunakan menu Masuk.';
  }
  if (msg.includes('password should be at least') || msg.includes('password is too short')) {
    return 'Password minimal 6 karakter.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Terlalu banyak permintaan. Harap tunggu beberapa saat sebelum mencoba lagi.';
  }
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return 'Koneksi internet bermasalah. Pastikan perangkat Anda terhubung ke internet.';
  }
  return rawMessage;
}

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly client: SupabaseClient = defaultSupabase) {}

  public async signIn(email: string, password: string): Promise<Result<AuthSession, DomainError>> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return err(new UnauthorizedError(localizeAuthError(error.message)));
      }

      if (!data.session || !data.user) {
        return err(new UnauthorizedError('Gagal membuat sesi pengguna'));
      }

      return ok(this.mapSession(data.session));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Kesalahan tidak terduga pada autentikasi'));
    }
  }

  public async signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<Result<AuthSession, DomainError>> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return err(new UnauthorizedError(localizeAuthError(error.message)));
      }

      if (!data.user) {
        return err(new UnauthorizedError('Pendaftaran gagal dibuat'));
      }

      // If Supabase has email confirmation enabled, session is null initially
      if (!data.session) {
        return err(
          new UnauthorizedError(
            'Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi sebelum masuk.'
          )
        );
      }

      return ok(this.mapSession(data.session));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Kesalahan tidak terduga pada registrasi'));
    }
  }

  public async signOut(): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) {
        return err(new DatabaseError(error.message));
      }
      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Gagal keluar'));
    }
  }

  public async getSession(): Promise<Result<AuthSession | null, DomainError>> {
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) {
        return err(new UnauthorizedError(error.message));
      }
      if (!data.session) {
        return ok(null);
      }
      return ok(this.mapSession(data.session));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Gagal membaca sesi'));
    }
  }

  public onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(session ? this.mapSession(session) : null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  private mapSession(session: Session): AuthSession {
    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        fullName: session.user.user_metadata?.full_name as string | undefined,
        createdAt: session.user.created_at,
      },
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
    };
  }
}

export const authRepository: IAuthRepository = new SupabaseAuthRepository();

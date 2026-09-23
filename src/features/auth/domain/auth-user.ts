export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

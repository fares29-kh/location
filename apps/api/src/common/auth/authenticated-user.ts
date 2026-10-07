import type { AdminRole, UserRole } from '@drivetn/types';

/** Identité extraite de l'access token, attachée à `request.user` par le JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  adminRole: AdminRole | null;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  adminRole: AdminRole | null;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/** Cookie httpOnly de l'access token (JWT court). */
export const ACCESS_TOKEN_COOKIE = 'drivetn_at';
/**
 * Cookie httpOnly du refresh token opaque. Chemin `/` : le middleware Next.js doit le voir
 * sur les pages pour renouveler une session expirée avant le rendu serveur.
 */
export const REFRESH_TOKEN_COOKIE = 'drivetn_rt';

export const IS_PUBLIC_KEY = 'drivetn:isPublic';
export const ROLES_KEY = 'drivetn:roles';

import {
  ACCESS_TOKEN_COOKIE,
  type CurrentUser,
  currentUserSchema,
  type Locale,
  type Portal,
  portalForRole,
} from '@drivetn/types';
import { cookies } from 'next/headers';
import { cache } from 'react';

import { getServerEnv } from '@/env';
import { redirect } from '@/i18n/navigation';

const SESSION_TIMEOUT_MS = 3_000;

/**
 * Utilisateur connecté pour le rendu serveur (une seule requête à l'API par rendu).
 * Le middleware a déjà renouvelé l'access token s'il avait expiré.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken === undefined || accessToken.length === 0) {
    return null;
  }
  try {
    const response = await fetch(`${getServerEnv().API_INTERNAL_URL}/api/v1/auth/me`, {
      headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const result = currentUserSchema.safeParse(await response.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
});

/** Utilisateur connecté dont le rôle relève de ce portail, sinon `null`. */
export async function getPortalUser(portal: Portal): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user !== null && portalForRole(user.role) === portal ? user : null;
}

/** Pour les pages privées : renvoie l'utilisateur ou redirige vers la connexion du portail. */
export async function requirePortalUser(portal: Portal, locale: Locale): Promise<CurrentUser> {
  const user = await getPortalUser(portal);
  return user ?? redirect({ href: '/login', locale });
}

/** Pour les pages de connexion / inscription : un utilisateur déjà connecté repart à l'accueil. */
export async function redirectIfAuthenticated(portal: Portal, locale: Locale): Promise<void> {
  if ((await getPortalUser(portal)) !== null) {
    redirect({ href: '/', locale });
  }
}

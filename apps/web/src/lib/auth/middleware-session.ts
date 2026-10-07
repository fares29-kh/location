import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@drivetn/types';
import type { NextRequest } from 'next/server';

const REFRESH_TIMEOUT_MS = 3_000;

export interface MiddlewareSession {
  authenticated: boolean;
  /** En-têtes Set-Cookie à renvoyer au navigateur (nouvelle paire de jetons). */
  setCookies: string[];
  /** En-tête Cookie à transmettre au rendu serveur, ou `null` s'il est inchangé. */
  cookieHeader: string | null;
}

/** Extrait `nom=valeur` d'un en-tête Set-Cookie. */
export function parseSetCookie(header: string): { name: string; value: string } | null {
  const pair = header.split(';', 1)[0] ?? '';
  const separator = pair.indexOf('=');
  if (separator <= 0) {
    return null;
  }
  return { name: pair.slice(0, separator).trim(), value: pair.slice(separator + 1).trim() };
}

/** Fusionne les cookies de la requête avec ceux que l'API vient de poser. */
export function mergeCookieHeader(
  current: { name: string; value: string }[],
  setCookies: string[],
): string {
  const jar = new Map(current.map((cookie) => [cookie.name, cookie.value]));
  for (const header of setCookies) {
    const parsed = parseSetCookie(header);
    if (parsed !== null) {
      jar.set(parsed.name, parsed.value);
    }
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

/**
 * Session vue par le middleware : un access token présent suffit (l'API le vérifie) ;
 * s'il a expiré mais qu'un refresh token existe, la session est renouvelée avant le rendu.
 * En cas d'échec, les cookies ne sont pas effacés : une rotation concurrente (autre onglet,
 * préchargement) a pu réussir entre-temps.
 */
export async function resolveMiddlewareSession(
  request: NextRequest,
  apiInternalUrl: string,
): Promise<MiddlewareSession> {
  const unauthenticated: MiddlewareSession = {
    authenticated: false,
    setCookies: [],
    cookieHeader: null,
  };
  if (request.cookies.get(ACCESS_TOKEN_COOKIE)?.value) {
    return { authenticated: true, setCookies: [], cookieHeader: null };
  }
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return unauthenticated;
  }

  try {
    const headers = new Headers({ Cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` });
    for (const name of ['host', 'x-forwarded-for', 'x-forwarded-proto', 'user-agent'] as const) {
      const value = request.headers.get(name);
      if (value !== null) {
        headers.set(name === 'host' ? 'x-forwarded-host' : name, value);
      }
    }
    const response = await fetch(`${apiInternalUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return unauthenticated;
    }
    const setCookies = response.headers.getSetCookie();
    return {
      authenticated: true,
      setCookies,
      cookieHeader: mergeCookieHeader(request.cookies.getAll(), setCookies),
    };
  } catch {
    return unauthenticated;
  }
}

import type { Portal } from '@drivetn/types';

/** Pages d'authentification, accessibles sans session sur chaque portail. */
const AUTH_PAGES: Record<Portal, readonly string[]> = {
  client: ['/login', '/signup', '/forgot-password', '/auth/handoff'],
  agency: ['/login', '/signup', '/forgot-password', '/auth/handoff'],
  admin: ['/login', '/forgot-password', '/auth/handoff'],
};

const CLIENT_PROTECTED_PREFIXES = ['/account', '/bookings'];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAuthPage(portal: Portal, pathname: string): boolean {
  return AUTH_PAGES[portal].some((page) => matchesPrefix(pathname, page));
}

/**
 * Les espaces agence et admin sont entièrement privés (hors pages d'authentification) ;
 * côté client, seul l'espace personnel l'est.
 */
export function isProtectedPath(portal: Portal, pathname: string): boolean {
  if (isAuthPage(portal, pathname)) {
    return false;
  }
  if (portal === 'client') {
    return CLIENT_PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  }
  return true;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 0x20) {
      return true;
    }
  }
  return false;
}

/** N'accepte qu'un chemin relatif au site (pas de redirection ouverte vers un autre domaine). */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (next === null || next === undefined || !next.startsWith('/') || next.startsWith('//')) {
    return null;
  }
  if (next.includes('\\') || hasControlCharacter(next)) {
    return null;
  }
  return next;
}

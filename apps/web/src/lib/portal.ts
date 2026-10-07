import { DEFAULT_LOCALE, isLocale, type Locale, type Portal } from '@drivetn/types';

/** Couleur de la barre du navigateur mobile, par portail. */
export const PORTAL_THEME_COLORS: Record<Portal, string> = {
  client: '#2563EB',
  agency: '#059669',
  admin: '#7C3AED',
};

const SUBDOMAIN_TO_PORTAL: Readonly<Record<string, Portal>> = {
  app: 'client',
  agency: 'agency',
  admin: 'admin',
};

/**
 * Détermine le portail à partir de l'en-tête Host.
 * `localhost` et `app.localhost` servent le portail client.
 */
export function resolvePortal(host: string | null, rootDomain: string): Portal | null {
  if (host === null || host.length === 0) {
    return null;
  }
  const hostname = (host.split(':')[0] ?? '').toLowerCase();
  const domain = rootDomain.toLowerCase();

  if (hostname === domain) {
    return 'client';
  }
  if (!hostname.endsWith(`.${domain}`)) {
    return null;
  }
  const subdomain = hostname.slice(0, -(domain.length + 1));
  return SUBDOMAIN_TO_PORTAL[subdomain] ?? null;
}

export type LocaleRoute =
  { type: 'redirect'; pathname: string } | { type: 'rewrite'; locale: Locale; pathname: string };

/**
 * Extrait la langue du premier segment de l'URL publique (préfixe « as-needed ») :
 * `/ar/...` et `/en/...` sont préfixés, le français ne l'est pas et `/fr/...` redirige.
 */
export function resolveLocaleRoute(pathname: string): LocaleRoute {
  const [, firstSegment = '', ...rest] = pathname.split('/');
  const remainder = `/${rest.join('/')}`;
  if (firstSegment === DEFAULT_LOCALE) {
    return { type: 'redirect', pathname: remainder };
  }
  if (isLocale(firstSegment)) {
    return { type: 'rewrite', locale: firstSegment, pathname: remainder };
  }
  return { type: 'rewrite', locale: DEFAULT_LOCALE, pathname };
}

/** Chemin interne (segments App Router `/{portail}/{langue}/...`) d'une URL publique. */
export function toPortalPath(portal: Portal, locale: Locale, pathname: string): string {
  return pathname === '/' ? `/${portal}/${locale}` : `/${portal}/${locale}${pathname}`;
}

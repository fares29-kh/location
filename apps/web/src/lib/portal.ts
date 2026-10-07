import { DEFAULT_LOCALE, isLocale, type Locale, type Portal } from '@drivetn/types';

export { buildPortalOrigin, resolvePortal } from '@drivetn/types';

/** Couleur de la barre du navigateur mobile, par portail. */
export const PORTAL_THEME_COLORS: Record<Portal, string> = {
  client: '#2563EB',
  agency: '#059669',
  admin: '#7C3AED',
};

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

/** URL publique d'un chemin dans une langue (le français n'a pas de préfixe). */
export function localizePath(locale: Locale, pathname: string): string {
  if (locale === DEFAULT_LOCALE) {
    return pathname;
  }
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
}

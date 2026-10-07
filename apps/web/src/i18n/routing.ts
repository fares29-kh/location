import { DEFAULT_LOCALE, LOCALES } from '@drivetn/types';
import { defineRouting } from 'next-intl/routing';

/**
 * Français sans préfixe (`/`), arabe et anglais préfixés (`/ar`, `/en`).
 * L'URL est la seule source de vérité : pas de détection ni de cookie de langue,
 * la résolution est faite par `src/middleware.ts` (combinée au portail).
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
});

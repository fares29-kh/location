import { z } from 'zod';

export const LOCALES = ['fr', 'ar', 'en'] as const;

export const DEFAULT_LOCALE = 'fr' satisfies (typeof LOCALES)[number];

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

export type Direction = 'ltr' | 'rtl';

export function isLocale(value: unknown): value is Locale {
  return localeSchema.safeParse(value).success;
}

export function getDirection(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

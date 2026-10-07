import { isLocale, type Locale } from '@drivetn/types';
import { notFound } from 'next/navigation';

export interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/** Valide le segment `[locale]` (posé par le middleware à partir de l'URL publique). */
export async function resolveLocale(params: LocaleParams['params']): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

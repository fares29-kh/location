import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export type AgencyPageKey =
  | 'dashboard'
  | 'bookings'
  | 'calendar'
  | 'payments'
  | 'expenses'
  | 'fleet'
  | 'customers'
  | 'reviews'
  | 'settings';

/** Titre localisé d'un écran de l'espace agence (le suffixe du portail vient du layout). */
export function agencyPageMetadata(page: AgencyPageKey) {
  return async ({ params }: LocaleParams): Promise<Metadata> => {
    const t = await getTranslations({
      locale: await resolveLocale(params),
      namespace: 'agency.nav',
    });
    return { title: t(page) };
  };
}

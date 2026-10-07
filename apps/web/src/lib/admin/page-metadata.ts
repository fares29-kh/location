import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export type AdminPageKey =
  'dashboard' | 'agencies' | 'users' | 'bookings' | 'billing' | 'reviews' | 'settings' | 'audit';

/** Titre localisé d'un écran de l'administration (le suffixe du portail vient du layout). */
export function adminPageMetadata(page: AdminPageKey) {
  return async ({ params }: LocaleParams): Promise<Metadata> => {
    const t = await getTranslations({
      locale: await resolveLocale(params),
      namespace: 'admin.nav',
    });
    return { title: t(page) };
  };
}

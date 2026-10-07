import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BookingsView } from '@/components/bookings/bookings-view';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({
    locale: await resolveLocale(params),
    namespace: 'client.bookings',
  });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function BookingsPage({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const user = await requirePortalUser('client', locale);
  return <BookingsView firstName={user.firstName} />;
}

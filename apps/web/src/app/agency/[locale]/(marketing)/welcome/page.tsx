import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AgencyWelcome } from '@/components/agency/welcome/welcome-view';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { getPortalOrigin } from '@/lib/portal-origin';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({
    locale: await resolveLocale(params),
    namespace: 'agency.welcome',
  });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: true, follow: true },
  };
}

export default async function AgencyWelcomePage({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  return <AgencyWelcome locale={locale} clientUrl={await getPortalOrigin('client')} />;
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AccountView } from '@/components/account/account-view';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({ locale: await resolveLocale(params), namespace: 'account' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const user = await requirePortalUser('client', locale);
  const t = await getTranslations({ locale, namespace: 'account' });

  return (
    <div className="container grid max-w-3xl gap-6 py-8 sm:py-12">
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <AccountView user={user} />
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { DesignShowcase } from '@/components/design/design-showcase';
import { getServerEnv } from '@/env';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export async function generateDesignMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'design' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/** Vitrine du design system, identique sur les trois portails (seule la couleur primaire change). */
export async function DesignPage({ params }: LocaleParams) {
  if (!getServerEnv().DESIGN_PAGE_ENABLED) {
    notFound();
  }
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'design' });

  return (
    <div className="container grid max-w-6xl gap-8 py-10">
      <header className="grid gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="max-w-2xl text-muted-foreground">{t('subtitle')}</p>
      </header>
      <DesignShowcase />
    </div>
  );
}

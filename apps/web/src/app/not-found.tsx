import { DEFAULT_LOCALE, isLocale } from '@drivetn/types';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import { BrandLogo } from '@/components/brand-logo';
import { NotFoundContent } from '@/components/pages/not-found-page';
import { RootDocument } from '@/components/root-document';
import { MAIN_CONTENT_ID } from '@/components/skip-link';
import { getServerEnv } from '@/env';
import { Link } from '@/i18n/navigation';
import { LOCALE_HEADER } from '@/i18n/locale-header';
import { resolvePortal } from '@/lib/portal';

async function resolveRequestContext() {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get(LOCALE_HEADER);
  return {
    locale: isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE,
    portal: resolvePortal(requestHeaders.get('host'), getServerEnv().APP_DOMAIN) ?? 'client',
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveRequestContext();
  const t = await getTranslations({ locale, namespace: 'notFound' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * Page 404 des URL inconnues, rendue côté serveur dans la langue et aux couleurs
 * du portail demandé (le middleware transmet la langue, l'hôte désigne le portail).
 */
export default async function GlobalNotFound() {
  const { locale, portal } = await resolveRequestContext();

  return (
    <RootDocument locale={locale} portal={portal}>
      <main id={MAIN_CONTENT_ID} className="grid min-h-dvh content-center justify-items-center">
        <Link
          href="/"
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo />
        </Link>
        <NotFoundContent />
      </main>
    </RootDocument>
  );
}

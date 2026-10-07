import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ClientFooter } from '@/components/client/client-footer';
import { ClientHeader } from '@/components/client/client-header';
import { MobileBottomNav } from '@/components/client/mobile-bottom-nav';
import { ReassuranceBanner } from '@/components/client/reassurance-banner';
import { RootDocument } from '@/components/root-document';
import { MAIN_CONTENT_ID } from '@/components/skip-link';
import { getServerEnv } from '@/env';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { buildPortalMetadata, buildPortalViewport } from '@/lib/metadata';

export const viewport = buildPortalViewport('client');

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return buildPortalMetadata('client', await resolveLocale(params));
}

export default async function ClientLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const locale = await resolveLocale(params);

  return (
    <RootDocument locale={locale} portal="client">
      <div className="flex min-h-dvh flex-col">
        <ReassuranceBanner />
        <ClientHeader designEnabled={getServerEnv().DESIGN_PAGE_ENABLED} />
        <main id={MAIN_CONTENT_ID} className="flex-1">
          {children}
        </main>
        <ClientFooter />
      </div>
      <MobileBottomNav />
    </RootDocument>
  );
}

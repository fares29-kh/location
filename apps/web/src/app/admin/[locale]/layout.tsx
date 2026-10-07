import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { RootDocument } from '@/components/root-document';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { buildPortalMetadata, buildPortalViewport } from '@/lib/metadata';

export const viewport = buildPortalViewport('admin');

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return buildPortalMetadata('admin', await resolveLocale(params));
}

export default async function AdminLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const locale = await resolveLocale(params);

  return (
    <RootDocument locale={locale} portal="admin">
      {children}
    </RootDocument>
  );
}

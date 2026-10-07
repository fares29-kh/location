import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { getServerEnv } from '@/env';

import './globals.css';

export function generateMetadata(): Metadata {
  const { APP_NAME } = getServerEnv();
  return {
    title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
    description: 'Location de voitures en Tunisie, sans paiement en ligne.',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  );
}

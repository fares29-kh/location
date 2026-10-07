import { getDirection, type Locale, type Portal } from '@drivetn/types';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import { SkipLink } from '@/components/skip-link';
import { fontVariables } from '@/lib/fonts';

import '@/app/globals.css';

export interface RootDocumentProps {
  locale: Locale;
  portal: Portal;
  children: ReactNode;
}

/** Document HTML commun aux trois portails : langue, sens de lecture, thème de portail. */
export function RootDocument({ locale, portal, children }: RootDocumentProps) {
  const dir = getDirection(locale);
  return (
    <html
      lang={locale}
      dir={dir}
      data-portal={portal}
      className={fontVariables}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <SkipLink />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

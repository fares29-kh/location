import type { Locale, Portal } from '@drivetn/types';
import type { Metadata, Viewport } from 'next';
import { getTranslations } from 'next-intl/server';

import { getServerEnv } from '@/env';
import { PORTAL_THEME_COLORS } from '@/lib/portal';

export async function buildPortalMetadata(portal: Portal, locale: Locale): Promise<Metadata> {
  const { APP_NAME } = getServerEnv();
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: {
      default: `${APP_NAME} · ${t(`portals.${portal}`)}`,
      template: `%s | ${APP_NAME}`,
    },
    description: t('tagline'),
    robots: portal === 'client' ? undefined : { index: false, follow: false },
  };
}

export function buildPortalViewport(portal: Portal): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: PORTAL_THEME_COLORS[portal],
  };
}

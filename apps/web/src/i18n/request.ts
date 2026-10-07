import { DEFAULT_LOCALE, isLocale, type Locale } from '@drivetn/types';
import { headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { LOCALE_HEADER } from './locale-header';
import type { Messages } from './messages';

const MESSAGE_LOADERS: Record<Locale, () => Promise<{ default: Messages }>> = {
  fr: () => import('../../messages/fr.json'),
  ar: () => import('../../messages/ar.json'),
  en: () => import('../../messages/en.json'),
};

export const APP_TIME_ZONE = 'Africa/Tunis';

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const requested = explicitLocale ?? (await headers()).get(LOCALE_HEADER);
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const { default: messages } = await MESSAGE_LOADERS[locale]();
  return { locale, messages, timeZone: APP_TIME_ZONE };
});

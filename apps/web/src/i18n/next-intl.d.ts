import type { Locale } from '@drivetn/types';

import type { Messages } from './messages';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}

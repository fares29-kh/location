import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { ConsoleMessagingProvider } from './console-messaging.provider';
import { MESSAGING_PROVIDER, type MessagingProvider } from './messaging.types';

/** Sélectionne l'implémentation de `MessagingProvider` selon `MESSAGING_PROVIDER`. */
@Module({
  providers: [
    ConsoleMessagingProvider,
    {
      provide: MESSAGING_PROVIDER,
      inject: [APP_CONFIG, ConsoleMessagingProvider],
      useFactory: (config: Env, consoleProvider: ConsoleMessagingProvider): MessagingProvider => {
        const providers: Record<Env['MESSAGING_PROVIDER'], MessagingProvider> = {
          console: consoleProvider,
        };
        return providers[config.MESSAGING_PROVIDER];
      },
    },
  ],
  exports: [MESSAGING_PROVIDER],
})
export class MessagingProviderModule {}

import { Injectable, Logger } from '@nestjs/common';

import type { MessagingProvider, OutboundMessage } from './messaging.types';

/** Fournisseur de développement : les messages (et donc les codes OTP) apparaissent dans les logs. */
@Injectable()
export class ConsoleMessagingProvider implements MessagingProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Messaging');

  send(message: OutboundMessage): Promise<void> {
    this.logger.log(`[${message.channel}] ${message.to} : ${message.body}`);
    return Promise.resolve();
  }
}

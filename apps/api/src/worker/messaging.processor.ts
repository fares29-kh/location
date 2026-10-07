import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import {
  type MessageJob,
  MESSAGING_PROVIDER,
  MESSAGING_QUEUE,
  type MessagingProvider,
} from '../messaging/messaging.types';
import { renderMessage } from '../messaging/templates';

/** Consomme la file `messaging` (OTP, puis confirmations et rappels) et délègue au fournisseur. */
@Injectable()
export class MessagingProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MessagingProcessor.name);
  private connection: Redis | undefined;
  private worker: Worker<MessageJob> | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Env,
    @Inject(MESSAGING_PROVIDER) private readonly provider: MessagingProvider,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.NODE_ENV === 'production' && this.provider.name === 'console') {
      this.logger.warn(
        'MESSAGING_PROVIDER=console en production : aucun SMS ni WhatsApp ne sera réellement envoyé.',
      );
    }
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    this.worker = new Worker<MessageJob>(MESSAGING_QUEUE, (job) => this.process(job), {
      connection: this.connection,
      concurrency: 5,
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Envoi ${job?.id ?? 'inconnu'} en échec : ${error.message}`);
    });
    this.logger.log(`File "${MESSAGING_QUEUE}" prête (fournisseur : ${this.provider.name})`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }

  async process(job: Job<MessageJob>): Promise<void> {
    await this.provider.send({
      channel: job.data.channel,
      to: job.data.to,
      body: renderMessage(job.data, this.config.APP_NAME),
    });
  }
}

import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { type MessageJob, MESSAGING_QUEUE, SEND_MESSAGE_JOB } from './messaging.types';

/** Producteur de la file `messaging` : l'envoi effectif est fait par le worker. */
@Injectable()
export class MessagingService implements OnApplicationShutdown {
  private connection: Redis | undefined;
  private queue: Queue<MessageJob> | undefined;

  constructor(@Inject(APP_CONFIG) private readonly config: Env) {}

  async enqueue(job: MessageJob): Promise<void> {
    await this.getQueue().add(SEND_MESSAGE_JOB, job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue?.close();
    await this.connection?.quit();
  }

  // Connexion ouverte au premier envoi : l'API démarre même si Redis est momentanément absent.
  private getQueue(): Queue<MessageJob> {
    if (this.queue === undefined) {
      this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
      this.queue = new Queue<MessageJob>(MESSAGING_QUEUE, { connection: this.connection });
    }
    return this.queue;
  }
}

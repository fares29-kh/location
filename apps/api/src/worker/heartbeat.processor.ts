import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  HEARTBEAT_JOB,
  MAINTENANCE_QUEUE,
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from './worker.constants';

/**
 * Job planifié qui prouve que la chaîne BullMQ fonctionne de bout en bout :
 * l'API lit la clé de battement pour exposer l'état du worker dans /health.
 */
@Injectable()
export class HeartbeatProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(HeartbeatProcessor.name);
  private connection: Redis | undefined;
  private queue: Queue | undefined;
  private worker: Worker | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Env,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // BullMQ exige des commandes bloquantes sans limite de tentatives.
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });

    this.queue = new Queue(MAINTENANCE_QUEUE, { connection: this.connection });
    this.worker = new Worker(MAINTENANCE_QUEUE, () => this.recordHeartbeat(), {
      connection: this.connection,
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.name ?? 'inconnu'} en échec : ${error.message}`);
    });

    await this.queue.upsertJobScheduler(
      HEARTBEAT_JOB,
      { every: WORKER_HEARTBEAT_INTERVAL_MS },
      { name: HEARTBEAT_JOB, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    await this.recordHeartbeat();
    this.logger.log(`Worker prêt (file "${MAINTENANCE_QUEUE}")`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async recordHeartbeat(): Promise<void> {
    await this.redis.set(
      WORKER_HEARTBEAT_KEY,
      new Date().toISOString(),
      'EX',
      WORKER_HEARTBEAT_TTL_SECONDS,
    );
  }
}

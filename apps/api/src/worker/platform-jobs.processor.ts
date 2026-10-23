import { addMonths, AGENCY_TIME_ZONE, toMonthKey } from '@drivetn/types';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { BookingExpiryService } from '../platform/booking-expiry.service';
import { InvoicingService } from '../platform/invoicing.service';
import {
  EXPIRE_BOOKINGS_INTERVAL_MS,
  EXPIRE_BOOKINGS_JOB,
  ISSUE_INVOICES_CRON,
  ISSUE_INVOICES_JOB,
  PLATFORM_QUEUE,
} from './worker.constants';

/** Tâches planifiées de la plateforme : expiration des demandes et facturation mensuelle. */
@Injectable()
export class PlatformJobsProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PlatformJobsProcessor.name);
  private connection: Redis | undefined;
  private queue: Queue | undefined;
  private worker: Worker | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Env,
    private readonly expiry: BookingExpiryService,
    private readonly invoicing: InvoicingService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.connection = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue(PLATFORM_QUEUE, { connection: this.connection });
    this.worker = new Worker(PLATFORM_QUEUE, (job) => this.process(job), {
      connection: this.connection,
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.name ?? 'inconnu'} en échec : ${error.message}`);
    });

    const opts = { removeOnComplete: true, removeOnFail: 100 };
    await this.queue.upsertJobScheduler(
      EXPIRE_BOOKINGS_JOB,
      { every: EXPIRE_BOOKINGS_INTERVAL_MS },
      { name: EXPIRE_BOOKINGS_JOB, opts },
    );
    await this.queue.upsertJobScheduler(
      ISSUE_INVOICES_JOB,
      { pattern: ISSUE_INVOICES_CRON, tz: AGENCY_TIME_ZONE },
      { name: ISSUE_INVOICES_JOB, opts },
    );
    this.logger.log(`File "${PLATFORM_QUEUE}" prête`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case EXPIRE_BOOKINGS_JOB:
        await this.expiry.expireStale();
        await this.invoicing.suspendLapsed();
        return;
      case ISSUE_INVOICES_JOB: {
        const now = new Date();
        await this.invoicing.ensureOpeningInvoices(now);
        await this.invoicing.issueForPeriod(addMonths(toMonthKey(now), -1), now);
        await this.invoicing.suspendLapsed(now);
        return;
      }
      default:
        this.logger.warn(`Job inconnu ignoré : ${job.name}`);
    }
  }
}

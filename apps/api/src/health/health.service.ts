import type { DependencyStatus, HealthResponse, HealthStatus } from '@drivetn/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { withTimeout } from '../common/utils/with-timeout';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { WORKER_HEARTBEAT_KEY } from '../worker/worker.constants';

export const HEALTH_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis, worker] = await Promise.all([
      this.probe('database', async () => {
        await this.prisma.$queryRaw`SELECT 1`;
        return true;
      }),
      this.probe('redis', async () => {
        await this.redis.ping();
        return true;
      }),
      this.probe('worker', async () => (await this.redis.get(WORKER_HEARTBEAT_KEY)) !== null),
    ]);

    return {
      status: computeStatus({ database, redis, worker }),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { database, redis, worker },
    };
  }

  private async probe(name: string, check: () => Promise<boolean>): Promise<DependencyStatus> {
    try {
      return (await withTimeout(check(), HEALTH_CHECK_TIMEOUT_MS)) ? 'up' : 'down';
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Dépendance "${name}" indisponible : ${reason}`);
      return 'down';
    }
  }
}

export function computeStatus(checks: HealthResponse['checks']): HealthStatus {
  if (checks.database === 'down' || checks.redis === 'down') {
    return 'error';
  }
  return checks.worker === 'down' ? 'degraded' : 'ok';
}

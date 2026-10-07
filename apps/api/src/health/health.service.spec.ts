import type { Redis } from 'ioredis';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { computeStatus, HEALTH_CHECK_TIMEOUT_MS, HealthService } from './health.service';

function createService(overrides: {
  queryRaw?: () => Promise<unknown>;
  ping?: () => Promise<string>;
  get?: () => Promise<string | null>;
}): HealthService {
  const prisma = {
    $queryRaw: vi.fn(overrides.queryRaw ?? (() => Promise.resolve([{ '?column?': 1 }]))),
  } as unknown as PrismaService;
  const redis = {
    ping: vi.fn(overrides.ping ?? (() => Promise.resolve('PONG'))),
    get: vi.fn(overrides.get ?? (() => Promise.resolve('2026-10-07T08:00:00.000Z'))),
  } as unknown as Redis;
  return new HealthService(prisma, redis);
}

describe('HealthService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renvoie ok quand toutes les dépendances répondent', async () => {
    const result = await createService({}).check();
    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ database: 'up', redis: 'up', worker: 'up' });
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('renvoie degraded quand le worker ne bat plus', async () => {
    const result = await createService({ get: () => Promise.resolve(null) }).check();
    expect(result.status).toBe('degraded');
    expect(result.checks.worker).toBe('down');
  });

  it('renvoie error quand la base de données échoue', async () => {
    const result = await createService({
      queryRaw: () => Promise.reject(new Error('connexion refusée')),
    }).check();
    expect(result.status).toBe('error');
    expect(result.checks.database).toBe('down');
  });

  it('renvoie error quand Redis échoue', async () => {
    const result = await createService({
      ping: () => Promise.reject(new Error('ECONNREFUSED')),
    }).check();
    expect(result.checks.redis).toBe('down');
    expect(result.status).toBe('error');
  });

  it('coupe une sonde qui dépasse le délai', async () => {
    vi.useFakeTimers();
    const service = createService({ queryRaw: () => new Promise(() => undefined) });

    const pending = service.check();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS + 1);
    const result = await pending;

    expect(result.checks.database).toBe('down');
  });
});

describe('computeStatus', () => {
  it.each([
    [{ database: 'up', redis: 'up', worker: 'up' }, 'ok'],
    [{ database: 'up', redis: 'up', worker: 'down' }, 'degraded'],
    [{ database: 'down', redis: 'up', worker: 'up' }, 'error'],
    [{ database: 'up', redis: 'down', worker: 'down' }, 'error'],
  ] as const)('%o => %s', (checks, expected) => {
    expect(computeStatus(checks)).toBe(expected);
  });
});

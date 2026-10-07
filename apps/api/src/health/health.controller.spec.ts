import type { HealthResponse } from '@drivetn/types';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

function buildResponse(status: HealthResponse['status']): HealthResponse {
  return {
    status,
    uptime: 1,
    timestamp: '2026-10-07T08:00:00.000Z',
    checks: { database: 'up', redis: 'up', worker: 'up' },
  };
}

function setup(status: HealthResponse['status']) {
  const health = { check: vi.fn().mockResolvedValue(buildResponse(status)) };
  const response = { status: vi.fn() };
  const controller = new HealthController(health as unknown as HealthService);
  return { controller, response, call: () => controller.check(response as unknown as Response) };
}

describe('HealthController', () => {
  it.each(['ok', 'degraded'] as const)('garde le statut 200 pour %s', async (status) => {
    const { response, call } = setup(status);
    await expect(call()).resolves.toMatchObject({ status });
    expect(response.status).not.toHaveBeenCalled();
  });

  it('renvoie 503 quand une dépendance critique est indisponible', async () => {
    const { response, call } = setup('error');
    await expect(call()).resolves.toMatchObject({ status: 'error' });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});

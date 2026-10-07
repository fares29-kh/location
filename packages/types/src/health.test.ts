import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health';

const validResponse = {
  status: 'ok',
  uptime: 12.5,
  timestamp: '2026-10-07T08:00:00.000Z',
  checks: { database: 'up', redis: 'up', worker: 'up' },
};

describe('healthResponseSchema', () => {
  it('accepte une réponse valide', () => {
    expect(healthResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it('refuse un statut inconnu', () => {
    const result = healthResponseSchema.safeParse({ ...validResponse, status: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('refuse un uptime négatif', () => {
    const result = healthResponseSchema.safeParse({ ...validResponse, uptime: -1 });
    expect(result.success).toBe(false);
  });

  it('refuse une dépendance manquante', () => {
    const result = healthResponseSchema.safeParse({
      ...validResponse,
      checks: { database: 'up', redis: 'up' },
    });
    expect(result.success).toBe(false);
  });
});

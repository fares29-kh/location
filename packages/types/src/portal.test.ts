import { describe, expect, it } from 'vitest';

import { PORTALS, portalSchema } from './portal';

describe('portalSchema', () => {
  it.each(PORTALS)('accepte le portail %s', (portal) => {
    expect(portalSchema.parse(portal)).toBe(portal);
  });

  it('refuse un portail inconnu', () => {
    expect(portalSchema.safeParse('partner').success).toBe(false);
  });
});

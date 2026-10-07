import { describe, expect, it } from 'vitest';

import { DEMO_ACCOUNTS, getDemoAccounts } from './demo';
import { isValidTunisianPhone } from './phone';
import { PORTALS } from './portal';

describe('comptes de démo', () => {
  it.each(PORTALS)('propose un compte pour le portail %s', (portal) => {
    expect(getDemoAccounts(portal)).toHaveLength(1);
  });

  it('utilise des identifiants uniques et des téléphones valides', () => {
    expect(new Set(DEMO_ACCOUNTS.map((account) => account.email)).size).toBe(DEMO_ACCOUNTS.length);
    for (const account of DEMO_ACCOUNTS) {
      expect(isValidTunisianPhone(account.phone)).toBe(true);
    }
  });
});

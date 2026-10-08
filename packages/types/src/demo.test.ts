import { describe, expect, it } from 'vitest';

import { DEMO_ACCOUNTS, getDemoAccounts } from './demo';
import { isValidTunisianPhone } from './phone';
import { PORTALS } from './portal';

describe('comptes de démo', () => {
  it.each(PORTALS)('propose au moins un compte pour le portail %s', (portal) => {
    expect(getDemoAccounts(portal).length).toBeGreaterThan(0);
  });

  it("propose un compte par rôle d'administration", () => {
    expect(getDemoAccounts('admin').map((account) => account.email)).toEqual([
      'admin@demo.tn',
      'support@demo.tn',
      'finance@demo.tn',
    ]);
  });

  it('utilise des identifiants uniques et des téléphones valides', () => {
    expect(new Set(DEMO_ACCOUNTS.map((account) => account.email)).size).toBe(DEMO_ACCOUNTS.length);
    for (const account of DEMO_ACCOUNTS) {
      expect(isValidTunisianPhone(account.phone)).toBe(true);
    }
  });
});

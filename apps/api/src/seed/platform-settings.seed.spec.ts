import { describe, expect, it, vi } from 'vitest';

import { PLATFORM_SETTING_SEEDS, seedPlatformSettings } from './platform-settings.seed';

describe('seedPlatformSettings', () => {
  it('crée chaque paramètre sans écraser les valeurs existantes', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { platformSetting: { upsert } } as unknown as Parameters<
      typeof seedPlatformSettings
    >[0];

    const count = await seedPlatformSettings(prisma);

    expect(count).toBe(PLATFORM_SETTING_SEEDS.length);
    expect(upsert).toHaveBeenCalledTimes(PLATFORM_SETTING_SEEDS.length);
    for (const call of upsert.mock.calls) {
      expect(call[0]).toMatchObject({ update: {} });
    }
  });

  it('exprime les montants et taux en entiers', () => {
    for (const setting of PLATFORM_SETTING_SEEDS) {
      if (typeof setting.value === 'number') {
        expect(Number.isInteger(setting.value)).toBe(true);
      }
    }
  });

  it('définit la TVA à 19 %, le timbre fiscal à 1 DT et l’expiration à 24 h par défaut', () => {
    const byKey = Object.fromEntries(PLATFORM_SETTING_SEEDS.map((s) => [s.key, s.value]));
    expect(byKey['tax.vatRateBps']).toBe(1900);
    expect(byKey['tax.fiscalStampMillimes']).toBe(1000);
    expect(byKey['booking.expiryHours']).toBe(24);
  });
});

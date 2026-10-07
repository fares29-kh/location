import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PLATFORM_SETTINGS, seedPlatformSettings } from './platform-settings.seed';

describe('seedPlatformSettings', () => {
  it('crée chaque paramètre sans écraser les valeurs existantes', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { platformSetting: { upsert } } as unknown as Parameters<
      typeof seedPlatformSettings
    >[0];

    const count = await seedPlatformSettings(prisma);

    expect(count).toBe(DEFAULT_PLATFORM_SETTINGS.length);
    expect(upsert).toHaveBeenCalledTimes(DEFAULT_PLATFORM_SETTINGS.length);
    for (const call of upsert.mock.calls) {
      expect(call[0]).toMatchObject({ update: {} });
    }
  });

  it('exprime les montants et taux en entiers', () => {
    for (const setting of DEFAULT_PLATFORM_SETTINGS) {
      expect(Number.isInteger(setting.value)).toBe(true);
    }
  });

  it('définit la TVA à 19 % et le timbre fiscal à 1 DT par défaut', () => {
    const byKey = Object.fromEntries(DEFAULT_PLATFORM_SETTINGS.map((s) => [s.key, s.value]));
    expect(byKey['tax.vatRateBps']).toBe(1900);
    expect(byKey['tax.fiscalStampMillimes']).toBe(1000);
  });
});

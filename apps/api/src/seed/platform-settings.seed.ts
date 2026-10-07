import type { PrismaClient } from '@prisma/client';

interface PlatformSettingSeed {
  key: string;
  value: number;
  description: string;
}

export const DEFAULT_PLATFORM_SETTINGS: readonly PlatformSettingSeed[] = [
  {
    key: 'tax.vatRateBps',
    value: 1900,
    description: 'Taux de TVA par défaut, en points de base (1900 = 19 %)',
  },
  {
    key: 'tax.fiscalStampMillimes',
    value: 1000,
    description: 'Timbre fiscal appliqué sur les factures, en millimes (1000 = 1 DT)',
  },
  {
    key: 'billing.defaultCommissionBps',
    value: 0,
    description: 'Commission par défaut sur les réservations, en points de base (0 = désactivée)',
  },
];

/** Idempotent : ne remplace jamais une valeur modifiée depuis le portail admin. */
export async function seedPlatformSettings(
  prisma: Pick<PrismaClient, 'platformSetting'>,
): Promise<number> {
  for (const setting of DEFAULT_PLATFORM_SETTINGS) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
  return DEFAULT_PLATFORM_SETTINGS.length;
}

import { DEFAULT_PLATFORM_SETTINGS } from '@drivetn/types';
import type { PrismaClient } from '@prisma/client';

import {
  PLATFORM_SETTING_DESCRIPTIONS,
  PLATFORM_SETTING_FIELDS,
  PLATFORM_SETTING_KEYS,
} from '../platform/platform-settings.keys';

interface PlatformSettingSeed {
  key: string;
  value: number | string;
  description: string;
}

export const PLATFORM_SETTING_SEEDS: readonly PlatformSettingSeed[] = PLATFORM_SETTING_FIELDS.map(
  (field) => ({
    key: PLATFORM_SETTING_KEYS[field],
    value: DEFAULT_PLATFORM_SETTINGS[field],
    description: PLATFORM_SETTING_DESCRIPTIONS[field],
  }),
);

/** Idempotent : ne remplace jamais une valeur modifiée depuis le portail admin. */
export async function seedPlatformSettings(
  prisma: Pick<PrismaClient, 'platformSetting'>,
): Promise<number> {
  for (const setting of PLATFORM_SETTING_SEEDS) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
  return PLATFORM_SETTING_SEEDS.length;
}

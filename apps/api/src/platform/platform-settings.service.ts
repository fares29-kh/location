import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
  platformSettingsSchema,
} from '@drivetn/types';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  PLATFORM_SETTING_DESCRIPTIONS,
  PLATFORM_SETTING_FIELDS,
  PLATFORM_SETTING_KEYS,
} from './platform-settings.keys';

function percent(bps: number): string {
  return `${String(bps / 100)} %`;
}

/** Libellé de chaque paramètre, pour tracer les modifications dans le journal d'audit. */
function describe(settings: PlatformSettings): Record<keyof PlatformSettings, string> {
  return {
    vatRateBps: `TVA ${percent(settings.vatRateBps)}`,
    fiscalStampMillimes: `Timbre ${String(settings.fiscalStampMillimes / 1000)} DT`,
    defaultCommissionBps: `Commission ${percent(settings.defaultCommissionBps)}`,
    bookingExpiryHours: `Expiration ${String(settings.bookingExpiryHours)} h`,
    supportPhone: `Support +216 ${settings.supportPhone}`,
    supportEmail: `Support ${settings.supportEmail}`,
  };
}

/** Changements lisibles entre deux jeux de paramètres (« TVA 19 % → TVA 13 % »). */
export function describeSettingsChanges(
  before: PlatformSettings,
  after: PlatformSettings,
): string[] {
  const from = describe(before);
  const to = describe(after);
  return PLATFORM_SETTING_FIELDS.filter((field) => from[field] !== to[field]).map(
    (field) => `${from[field]} → ${to[field]}`,
  );
}

/** Paramètres globaux stockés clé par clé dans `platform_settings`. */
@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Une valeur absente ou invalide est remplacée par sa valeur par défaut. */
  async get(): Promise<PlatformSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: Object.values(PLATFORM_SETTING_KEYS) } },
    });
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const settings = { ...DEFAULT_PLATFORM_SETTINGS };
    for (const field of PLATFORM_SETTING_FIELDS) {
      const parsed = platformSettingsSchema.shape[field].safeParse(
        values.get(PLATFORM_SETTING_KEYS[field]),
      );
      if (parsed.success) {
        Object.assign(settings, { [field]: parsed.data });
      } else if (values.has(PLATFORM_SETTING_KEYS[field])) {
        this.logger.warn(`Paramètre "${PLATFORM_SETTING_KEYS[field]}" invalide, valeur par défaut`);
      }
    }
    return settings;
  }

  async update(next: PlatformSettings): Promise<PlatformSettings> {
    await this.prisma.$transaction(
      PLATFORM_SETTING_FIELDS.map((field) =>
        this.prisma.platformSetting.upsert({
          where: { key: PLATFORM_SETTING_KEYS[field] },
          create: {
            key: PLATFORM_SETTING_KEYS[field],
            value: next[field],
            description: PLATFORM_SETTING_DESCRIPTIONS[field],
          },
          update: { value: next[field] },
        }),
      ),
    );
    return next;
  }
}

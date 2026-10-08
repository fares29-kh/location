import type { PlatformSettings } from '@drivetn/types';

/** Clé de chaque paramètre dans la table `platform_settings`. */
export const PLATFORM_SETTING_KEYS = {
  vatRateBps: 'tax.vatRateBps',
  fiscalStampMillimes: 'tax.fiscalStampMillimes',
  defaultCommissionBps: 'billing.defaultCommissionBps',
  bookingExpiryHours: 'booking.expiryHours',
  supportPhone: 'support.phone',
  supportEmail: 'support.email',
} as const satisfies Record<keyof PlatformSettings, string>;

export const PLATFORM_SETTING_DESCRIPTIONS: Record<keyof PlatformSettings, string> = {
  vatRateBps: 'Taux de TVA par défaut, en points de base (1900 = 19 %)',
  fiscalStampMillimes: 'Timbre fiscal appliqué sur les factures, en millimes (1000 = 1 DT)',
  defaultCommissionBps:
    'Commission par défaut sur les réservations, en points de base (0 = désactivée)',
  bookingExpiryHours: 'Délai en heures au-delà duquel une demande sans réponse expire',
  supportPhone: 'Numéro du support affiché aux agences et aux clients (8 chiffres)',
  supportEmail: 'Adresse e-mail du support',
};

export const PLATFORM_SETTING_FIELDS = Object.keys(
  PLATFORM_SETTING_KEYS,
) as (keyof PlatformSettings)[];

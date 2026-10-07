import type { Locale } from './locale';

/** 1 dinar tunisien = 1000 millimes. Tous les montants sont stockés en millimes (entiers). */
export const MILLIMES_PER_DINAR = 1000;

interface MoneyFormat {
  groupSeparator: string;
  decimalSeparator: string;
  currency: string;
}

const NARROW_NO_BREAK_SPACE = '\u202F';
const NO_BREAK_SPACE = '\u00A0';

const MONEY_FORMATS: Record<Locale, MoneyFormat> = {
  fr: { groupSeparator: NARROW_NO_BREAK_SPACE, decimalSeparator: ',', currency: 'DT' },
  ar: { groupSeparator: ',', decimalSeparator: '.', currency: 'د.ت' },
  en: { groupSeparator: ',', decimalSeparator: '.', currency: 'TND' },
};

export interface FormatMoneyOptions {
  /** Ajoute le symbole monétaire (par défaut : oui). */
  withCurrency?: boolean;
}

function assertMillimes(millimes: number): void {
  if (!Number.isSafeInteger(millimes)) {
    throw new RangeError(`Montant invalide : ${String(millimes)} (entier en millimes attendu)`);
  }
}

/**
 * Formate un montant en millimes, avec les 3 décimales du dinar.
 * Formatage manuel (et non Intl) pour un rendu identique serveur/navigateur.
 *
 * @example formatMillimes(85000, 'fr') // "85,000 DT"
 * @example formatMillimes(85000, 'ar') // "85.000 د.ت"
 */
export function formatMillimes(
  millimes: number,
  locale: Locale,
  { withCurrency = true }: FormatMoneyOptions = {},
): string {
  assertMillimes(millimes);
  const format = MONEY_FORMATS[locale];
  const absolute = Math.abs(millimes);
  const dinars = Math.trunc(absolute / MILLIMES_PER_DINAR);
  const rest = absolute % MILLIMES_PER_DINAR;

  const groupedDinars = String(dinars).replace(/\B(?=(\d{3})+(?!\d))/g, format.groupSeparator);
  const amount = `${millimes < 0 ? '-' : ''}${groupedDinars}${format.decimalSeparator}${String(rest).padStart(3, '0')}`;

  return withCurrency ? `${amount}${NO_BREAK_SPACE}${format.currency}` : amount;
}

/** Convertit des dinars (saisie utilisateur) en millimes, en arrondissant au millime. */
export function dinarsToMillimes(dinars: number): number {
  if (!Number.isFinite(dinars)) {
    throw new RangeError(`Montant invalide : ${String(dinars)}`);
  }
  return Math.round(dinars * MILLIMES_PER_DINAR);
}

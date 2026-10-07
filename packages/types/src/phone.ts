import { z } from 'zod';

export const TUNISIA_DIAL_CODE = '216';

/**
 * Numéro national tunisien : 8 chiffres.
 * Premier chiffre : 2, 4, 5, 9 (mobiles) ou 3, 7 (fixes et VoIP).
 */
const NATIONAL_NUMBER_PATTERN = /^[234579]\d{7}$/;

const MOBILE_PREFIXES = new Set(['2', '4', '5', '9']);

/**
 * Extrait les 8 chiffres nationaux d'une saisie libre (+216, 00216, espaces, tirets...).
 * Renvoie la saisie nettoyée telle quelle si elle ne correspond à aucun format connu.
 */
export function normalizeTunisianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith(`00${TUNISIA_DIAL_CODE}`)) {
    return digits.slice(5);
  }
  if (digits.length === 11 && digits.startsWith(TUNISIA_DIAL_CODE)) {
    return digits.slice(3);
  }
  return digits;
}

export function isValidTunisianPhone(input: string): boolean {
  return NATIONAL_NUMBER_PATTERN.test(normalizeTunisianPhone(input));
}

export function isTunisianMobile(input: string): boolean {
  const national = normalizeTunisianPhone(input);
  return NATIONAL_NUMBER_PATTERN.test(national) && MOBILE_PREFIXES.has(national.charAt(0));
}

/** Format E.164 : +216XXXXXXXX. */
export function toE164(input: string): string {
  return `+${TUNISIA_DIAL_CODE}${normalizeTunisianPhone(input)}`;
}

/** Groupe les chiffres nationaux en « XX XXX XXX », y compris pendant la saisie. */
export function formatNationalPhone(input: string): string {
  const national = normalizeTunisianPhone(input).slice(0, 8);
  return [national.slice(0, 2), national.slice(2, 5), national.slice(5, 8)]
    .filter((part) => part.length > 0)
    .join(' ');
}

/** Format d'affichage international : +216 XX XXX XXX. */
export function formatInternationalPhone(input: string): string {
  return `+${TUNISIA_DIAL_CODE} ${formatNationalPhone(input)}`;
}

/** Lien « Contacter sur WhatsApp » (wa.me), avec message pré-rempli optionnel. */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const url = new URL(`https://wa.me/${TUNISIA_DIAL_CODE}${normalizeTunisianPhone(phone)}`);
  if (message !== undefined && message.length > 0) {
    url.searchParams.set('text', message);
  }
  return url.toString();
}

/** Valide une saisie et la transforme en numéro national à 8 chiffres. */
export const tunisianPhoneSchema = z
  .string()
  .trim()
  .refine(isValidTunisianPhone, { message: 'INVALID_TUNISIAN_PHONE' })
  .transform(normalizeTunisianPhone);

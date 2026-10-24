import type { Locale } from '@drivetn/types';

/**
 * Aéroports internationaux tunisiens (code IATA) proposés comme lieux de prise en charge.
 * `slug` correspond au référentiel des lieux de l'API.
 */
export const AIRPORTS = [
  { id: 'tunisCarthage', code: 'TUN', slug: 'aeroport-tunis-carthage' },
  { id: 'enfidha', code: 'NBE', slug: 'aeroport-enfidha-hammamet' },
  { id: 'monastir', code: 'MIR', slug: 'aeroport-monastir' },
  { id: 'djerba', code: 'DJE', slug: 'aeroport-djerba-zarzis' },
  { id: 'sfaxAirport', code: 'SFA', slug: 'aeroport-sfax-thyna' },
  { id: 'tozeur', code: 'TOE', slug: 'aeroport-tozeur-nefta' },
  { id: 'tabarka', code: 'TBJ', slug: 'aeroport-tabarka-ain-draham' },
  { id: 'gafsa', code: 'GAF', slug: 'aeroport-gafsa-ksar' },
] as const;

/** Villes mises en avant ; l'identifiant est aussi le slug du référentiel. */
export const CITIES = ['tunis', 'sousse', 'hammamet', 'sfax', 'bizerte'] as const;

/** Les 24 gouvernorats, utilisés si le référentiel public ne répond pas. */
const GOVERNORATE_FALLBACK = [
  { code: '11', fr: 'Tunis', en: 'Tunis', ar: 'تونس' },
  { code: '12', fr: 'Ariana', en: 'Ariana', ar: 'أريانة' },
  { code: '13', fr: 'Ben Arous', en: 'Ben Arous', ar: 'بن عروس' },
  { code: '14', fr: 'La Manouba', en: 'Manouba', ar: 'منوبة' },
  { code: '21', fr: 'Nabeul', en: 'Nabeul', ar: 'نابل' },
  { code: '22', fr: 'Zaghouan', en: 'Zaghouan', ar: 'زغوان' },
  { code: '23', fr: 'Bizerte', en: 'Bizerte', ar: 'بنزرت' },
  { code: '31', fr: 'Béja', en: 'Beja', ar: 'باجة' },
  { code: '32', fr: 'Jendouba', en: 'Jendouba', ar: 'جندوبة' },
  { code: '33', fr: 'Le Kef', en: 'Kef', ar: 'الكاف' },
  { code: '34', fr: 'Siliana', en: 'Siliana', ar: 'سليانة' },
  { code: '41', fr: 'Kairouan', en: 'Kairouan', ar: 'القيروان' },
  { code: '42', fr: 'Kasserine', en: 'Kasserine', ar: 'القصرين' },
  { code: '43', fr: 'Sidi Bouzid', en: 'Sidi Bouzid', ar: 'سيدي بوزيد' },
  { code: '51', fr: 'Sousse', en: 'Sousse', ar: 'سوسة' },
  { code: '52', fr: 'Monastir', en: 'Monastir', ar: 'المنستير' },
  { code: '53', fr: 'Mahdia', en: 'Mahdia', ar: 'المهدية' },
  { code: '61', fr: 'Sfax', en: 'Sfax', ar: 'صفاقس' },
  { code: '71', fr: 'Gafsa', en: 'Gafsa', ar: 'قفصة' },
  { code: '72', fr: 'Tozeur', en: 'Tozeur', ar: 'توزر' },
  { code: '73', fr: 'Kébili', en: 'Kebili', ar: 'قبلي' },
  { code: '81', fr: 'Gabès', en: 'Gabes', ar: 'قابس' },
  { code: '82', fr: 'Médenine', en: 'Medenine', ar: 'مدنين' },
  { code: '83', fr: 'Tataouine', en: 'Tataouine', ar: 'تطاوين' },
] as const;

export function fallbackGovernorates(locale: Locale): { code: string; label: string }[] {
  return GOVERNORATE_FALLBACK.map((row) => ({ code: row.code, label: row[locale] }));
}

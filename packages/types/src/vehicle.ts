import { z } from 'zod';

/** Identifiant d'URL : minuscules, chiffres et tirets (ex. « suv », « ben-arous »). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 40;

export const slugSchema = z
  .string()
  .trim()
  .min(1, { message: 'REQUIRED', abort: true })
  .max(SLUG_MAX, { message: 'TOO_LONG' })
  .regex(SLUG_PATTERN, { message: 'INVALID_SLUG' });

/** Slug proposé à partir d'un libellé (« Mini-van 7 places » → « mini-van-7-places »). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const;
export const transmissionSchema = z.enum(TRANSMISSIONS);
export type Transmission = z.infer<typeof transmissionSchema>;

export const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'] as const;
export const fuelTypeSchema = z.enum(FUEL_TYPES);
export type FuelType = z.infer<typeof fuelTypeSchema>;

/**
 * Statut administratif du véhicule. La location en cours n'est pas un statut :
 * elle se déduit des réservations.
 */
export const VEHICLE_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const;
export const vehicleStatusSchema = z.enum(VEHICLE_STATUSES);
export type VehicleStatus = z.infer<typeof vehicleStatusSchema>;

export const VEHICLE_YEAR_MIN = 2000;
export const VEHICLE_SEATS_MIN = 2;
export const VEHICLE_SEATS_MAX = 9;

export const VEHICLE_BRAND_MAX = 40;
export const VEHICLE_MODEL_MAX = 40;

/** Appellations courantes d'une marque, vers son nom officiel. */
const BRAND_ALIASES: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  vw: 'Volkswagen',
  greatwall: 'GWM',
  landrover: 'Land Rover',
  rangerover: 'Land Rover',
  kgm: 'SsangYong',
};

/** Clé de comparaison d'un nom de marque : casse, accents, espaces et tirets ignorés. */
export function vehicleBrandKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/** Marque de la liste correspondant à une saisie (casse, accents, tirets et alias ignorés), sinon `null`. */
export function matchVehicleBrand(input: string, brands: readonly string[]): string | null {
  const byKey = new Map(brands.map((brand) => [vehicleBrandKey(brand), brand]));
  const key = vehicleBrandKey(input);
  const alias = BRAND_ALIASES[key];
  return (
    byKey.get(key) ?? (alias === undefined ? null : (byKey.get(vehicleBrandKey(alias)) ?? null))
  );
}

/** Modèle de la liste correspondant à une saisie (casse, accents, espaces et tirets ignorés), sinon `null`. */
export function matchVehicleModel(input: string, models: readonly string[]): string | null {
  const key = vehicleBrandKey(input);
  return models.find((model) => vehicleBrandKey(model) === key) ?? null;
}

/** Photos d'un véhicule : la première sert de couverture. */
export const VEHICLE_PHOTOS_MAX = 10;
export const VEHICLE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const VEHICLE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function isVehiclePhotoType(type: string): boolean {
  return (VEHICLE_PHOTO_TYPES as readonly string[]).includes(type);
}

export interface VehiclePhoto {
  id: string;
  /** Grande taille (1600 px max.), pour la galerie. */
  url: string;
  /** Vignette (640 px max.), pour les cartes et les listes. */
  thumbUrl: string;
  width: number;
  height: number;
}

export const vehiclePhotoOrderSchema = z.object({
  photoIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(VEHICLE_PHOTOS_MAX)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'DUPLICATE_PHOTO' }),
});

export type VehiclePhotoOrder = z.infer<typeof vehiclePhotoOrderSchema>;

/** Immatriculation tunisienne standard : « 123 TU 4567 » (série, puis numéro d'ordre). */
const TUNISIAN_PLATE_PATTERN = /^(\d{1,3})\s*(?:TU|تونس)\s*(\d{1,4})$/iu;

export function isValidTunisianPlate(input: string): boolean {
  return TUNISIAN_PLATE_PATTERN.test(input.trim());
}

/** Forme canonique « 123 TU 4567 », quelle que soit la saisie (espaces, minuscules, « تونس »). */
export function normalizeTunisianPlate(input: string): string {
  const match = TUNISIAN_PLATE_PATTERN.exec(input.trim());
  return match === null ? input.trim().toUpperCase() : `${match[1] ?? ''} TU ${match[2] ?? ''}`;
}

export function vehicleYearMax(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

/**
 * Saisie d'un véhicule. La marque, son modèle et la catégorie doivent exister dans les
 * référentiels de l'administration : l'API les vérifie (`INVALID_BRAND`, `INVALID_MODEL`,
 * `INVALID_CATEGORY`).
 */
export const vehicleInputSchema = z.object({
  brand: z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .max(VEHICLE_BRAND_MAX, { message: 'TOO_LONG' }),
  model: z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .max(VEHICLE_MODEL_MAX, { message: 'TOO_LONG' }),
  year: z
    .number()
    .int()
    .min(VEHICLE_YEAR_MIN, { message: 'OUT_OF_RANGE' })
    .refine((year) => year <= vehicleYearMax(), { message: 'OUT_OF_RANGE' }),
  /** Facultative : chaîne vide ou `null` si l'agence ne la renseigne pas. */
  plateNumber: z
    .string()
    .trim()
    .nullish()
    .refine((plate) => !plate || isValidTunisianPlate(plate), { message: 'INVALID_PLATE' })
    .transform((plate) => (plate ? normalizeTunisianPlate(plate) : null)),
  /** Slug d'une catégorie du référentiel. */
  category: slugSchema,
  transmission: transmissionSchema,
  fuel: fuelTypeSchema,
  seats: z
    .number()
    .int()
    .min(VEHICLE_SEATS_MIN, { message: 'OUT_OF_RANGE' })
    .max(VEHICLE_SEATS_MAX, { message: 'OUT_OF_RANGE' }),
  airConditioning: z.boolean(),
  dailyRateMillimes: z.number().int().positive({ message: 'INVALID_AMOUNT' }),
  depositMillimes: z.number().int().nonnegative({ message: 'INVALID_AMOUNT' }),
  /** `null` : kilométrage illimité. */
  mileageLimitKm: z.number().int().positive({ message: 'OUT_OF_RANGE' }).nullable(),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

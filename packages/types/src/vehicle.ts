import { z } from 'zod';

export const VEHICLE_CATEGORIES = [
  'ECONOMY',
  'COMPACT',
  'SEDAN',
  'SUV',
  'MINIVAN',
  'LUXURY',
] as const;
export const vehicleCategorySchema = z.enum(VEHICLE_CATEGORIES);
export type VehicleCategory = z.infer<typeof vehicleCategorySchema>;

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

export const vehicleInputSchema = z.object({
  brand: z.string().trim().min(1, { message: 'REQUIRED' }).max(40, { message: 'TOO_LONG' }),
  model: z.string().trim().min(1, { message: 'REQUIRED' }).max(40, { message: 'TOO_LONG' }),
  year: z
    .number()
    .int()
    .min(VEHICLE_YEAR_MIN, { message: 'OUT_OF_RANGE' })
    .refine((year) => year <= vehicleYearMax(), { message: 'OUT_OF_RANGE' }),
  plateNumber: z
    .string()
    .trim()
    .refine(isValidTunisianPlate, { message: 'INVALID_PLATE' })
    .transform(normalizeTunisianPlate),
  category: vehicleCategorySchema,
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

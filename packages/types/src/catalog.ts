import { z } from 'zod';

import type { BookingEvent } from './agency-portal';
import { type BookingStatus, type PaymentMethod, rentalDays } from './booking';
import { addDays, type DayKey, tunisDateTime } from './dates';
import type { LocalizedText } from './location';
import type { ReviewModerationStatus } from './platform';
import { type FuelType, slugSchema, type Transmission, type VehiclePhoto } from './vehicle';

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'INVALID_DATE' });

/** Heure de prise en charge et de retour (heure de Tunis) quand seule la date est choisie. */
export const DEFAULT_PICKUP_HOUR = 10;

/** Remise appliquée aux locations d'une semaine ou plus. */
export const WEEKLY_DISCOUNT_DAYS = 7;
const WEEKLY_DISCOUNT_RATE = 0.9;

/** Prix d'une location, arrondi au dinar (remise de 10 % à partir de 7 jours). */
export function rentalPriceMillimes(dailyRateMillimes: number, days: number): number {
  const discount = days >= WEEKLY_DISCOUNT_DAYS ? WEEKLY_DISCOUNT_RATE : 1;
  return Math.round((dailyRateMillimes * days * discount) / 1000) * 1000;
}

/** Créneau de location à partir de deux jours calendaires (prise et retour à 10 h). */
export function rentalWindow(pickup: DayKey, dropoff: DayKey) {
  const pickupAt = tunisDateTime(pickup, DEFAULT_PICKUP_HOUR);
  const returnAt = tunisDateTime(dropoff, DEFAULT_PICKUP_HOUR);
  return { pickupAt, returnAt, days: rentalDays(pickupAt, returnAt) };
}

/**
 * Créneau déjà pris. `pickup` est inclus, `return` est le matin où la voiture est de nouveau
 * libre (exclu), à la même heure que le départ.
 */
export interface UnavailableRange {
  pickup: DayKey;
  return: DayKey;
}

/** Deux créneaux [départ, retour[ se chevauchent. Le retour et le départ suivant au même matin sont libres. */
export function rangesOverlap(
  pickup: DayKey,
  dropoff: DayKey,
  ranges: readonly UnavailableRange[],
): boolean {
  return ranges.some((range) => pickup < range.return && dropoff > range.pickup);
}

/** Le véhicule est sorti ce jour-là : on ne peut pas le prendre, ni le rendre après l'avoir inclus. */
export function isDayOccupied(day: DayKey, ranges: readonly UnavailableRange[]): boolean {
  return rangesOverlap(day, addDays(day, 1), ranges);
}

/** Fusionne les créneaux qui se touchent pour n'afficher qu'une période par absence. */
export function mergeUnavailableRanges(ranges: readonly UnavailableRange[]): UnavailableRange[] {
  const sorted = ranges
    .filter((range) => range.return > range.pickup)
    .sort((a, b) => a.pickup.localeCompare(b.pickup) || a.return.localeCompare(b.return));
  const merged: UnavailableRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && range.pickup <= last.return) {
      merged[merged.length - 1] = {
        pickup: last.pickup,
        return: range.return > last.return ? range.return : last.return,
      };
    } else {
      merged.push({ pickup: range.pickup, return: range.return });
    }
  }
  return merged;
}

export type RentalDayChoice =
  | { kind: 'range'; pickup: DayKey; return: DayKey | null }
  | { kind: 'rejected'; reason: 'unavailable' | 'overlap' };

/**
 * Clic sur un jour du calendrier. Un jour passé ou déjà pris est refusé. Un retour qui
 * traverserait une réservation confirmée est refusé sans changer le départ déjà choisi.
 */
export function selectRentalDay(
  current: { pickup: DayKey | null; return: DayKey | null },
  day: DayKey,
  ranges: readonly UnavailableRange[],
  today: DayKey,
): RentalDayChoice {
  if (day < today || isDayOccupied(day, ranges)) {
    return { kind: 'rejected', reason: 'unavailable' };
  }
  if (current.pickup === null || current.return !== null || day <= current.pickup) {
    return { kind: 'range', pickup: day, return: null };
  }
  if (rangesOverlap(current.pickup, day, ranges)) {
    return { kind: 'rejected', reason: 'overlap' };
  }
  return { kind: 'range', pickup: current.pickup, return: day };
}

// --- Recherche publique ----------------------------------------------------------

export const offerSearchSchema = z.object({
  /** Slug d'un lieu (aéroport, ville...) ; vide = toute la Tunisie. */
  location: z.string().trim().max(80).optional().catch(undefined),
  /** Code d'un gouvernorat, utilisé quand aucun lieu précis n'est choisi. */
  governorate: z
    .string()
    .regex(/^\d{2}$/)
    .optional()
    .catch(undefined),
  pickup: dayKeySchema.optional().catch(undefined),
  return: dayKeySchema.optional().catch(undefined),
  /** Slug d'une catégorie. */
  category: slugSchema.optional().catch(undefined),
});

export type OfferSearch = z.infer<typeof offerSearchSchema>;

export interface OfferAgency {
  id: string;
  name: string;
  /** URL publique du logo, `null` sans logo. */
  logoUrl: string | null;
  governorateCode: string;
  address: string;
  /** Note moyenne sur 5, `null` sans avis. */
  rating: number | null;
  reviewsCount: number;
  instantConfirmation: boolean;
  freeCancellationHours: number;
  minDriverAge: number;
  acceptedPaymentMethods: PaymentMethod[];
}

export interface Offer {
  vehicleId: string;
  brand: string;
  model: string;
  year: number;
  /** Slug de la catégorie. */
  category: string;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  airConditioning: boolean;
  color: string;
  /** Dans l'ordre choisi par l'agence ; la première est la couverture. */
  photos: VehiclePhoto[];
  dailyRateMillimes: number;
  depositMillimes: number;
  /** `null` : kilométrage illimité. */
  mileageLimitKm: number | null;
  agency: OfferAgency;
  /** Créneaux déjà pris. Le jour `return` est libre à 10 h. */
  unavailable: UnavailableRange[];
}

export interface OfferSearchResult {
  offers: Offer[];
  /** Nombre de jours facturés si les deux dates sont fournies. */
  days: number | null;
}

// --- Annuaire public des agences --------------------------------------------------

/** Agence active telle qu'affichée sur la carte publique du réseau. */
export const publicAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** URL publique du logo, `null` sans logo. */
  logoUrl: z.string().nullable(),
  governorateCode: z.string(),
  address: z.string(),
  description: z.string(),
  phone: z.string(),
  whatsappPhone: z.string(),
  /** Autres numéros, en plus du téléphone principal. */
  extraPhones: z.array(z.string()).default([]),
  /** Note moyenne sur 5, `null` sans avis. */
  rating: z.number().min(0).max(5).nullable(),
  reviewsCount: z.number().int().min(0),
  vehiclesCount: z.number().int().min(0),
  /** Tarif journalier le plus bas de la flotte active, `null` sans véhicule. */
  fromDailyRateMillimes: z.number().int().min(0).nullable(),
  /** Slugs des catégories de la flotte active, dans l'ordre du référentiel. */
  categories: z.array(z.string()),
  instantConfirmation: z.boolean(),
  freeCancellationHours: z.number().int().min(0),
  /** Les agences n'ont pas d'adresse géocodée : position du chef-lieu de leur gouvernorat. */
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type PublicAgency = z.infer<typeof publicAgencySchema>;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Écart entre deux agences voisines, environ 1 km. */
const SPREAD_STEP_DEGREES = 0.009;

/**
 * Position du n-ième point autour d'un même centre, en spirale à angle d'or, pour que les
 * agences d'une même ville ne se superposent pas sur la carte ; l'index 0 reste au centre.
 */
export function spreadAround(center: GeoPoint, index: number): GeoPoint {
  if (index <= 0) {
    return center;
  }
  const radius = SPREAD_STEP_DEGREES * Math.sqrt(index);
  const angle = index * GOLDEN_ANGLE;
  const longitudeScale = Math.cos((center.latitude * Math.PI) / 180);
  return {
    latitude: Number((center.latitude + radius * Math.sin(angle)).toFixed(5)),
    longitude: Number((center.longitude + (radius * Math.cos(angle)) / longitudeScale).toFixed(5)),
  };
}

// --- Réservations du client -----------------------------------------------------

export const BOOKING_NOTE_MAX = 300;

export const createBookingSchema = z
  .object({
    vehicleId: z.string().trim().min(1, { message: 'REQUIRED' }),
    pickup: dayKeySchema,
    return: dayKeySchema,
    location: z.string().trim().min(1, { message: 'REQUIRED' }).max(80),
    note: z.string().trim().max(BOOKING_NOTE_MAX, { message: 'TOO_LONG' }).optional(),
  })
  .refine((value) => value.return > value.pickup, {
    message: 'RETURN_BEFORE_PICKUP',
    path: ['return'],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(BOOKING_NOTE_MAX, { message: 'TOO_LONG' }).optional(),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;

/** Un avis par location, une fois le véhicule rendu. */
export const createReviewSchema = z.object({
  rating: z
    .number({ message: 'REQUIRED' })
    .int({ message: 'OUT_OF_RANGE' })
    .min(1, { message: 'REQUIRED' })
    .max(5, { message: 'OUT_OF_RANGE' }),
  comment: z
    .string()
    .trim()
    .min(REVIEW_COMMENT_MIN, { message: 'TOO_SHORT' })
    .max(REVIEW_COMMENT_MAX, { message: 'TOO_LONG' }),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** Avis laissé par le client sur sa propre réservation, y compris s'il a été masqué. */
export interface CustomerReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
  moderationStatus: ReviewModerationStatus;
}

/** Avis publié, sans le nom complet du client. */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
}

export function canCustomerReview(status: BookingStatus): boolean {
  return status === 'RETURNED' || status === 'COMPLETED';
}

/** Modifiable tant que l'agence n'a pas répondu et que l'avis n'est pas en modération. */
export function canEditCustomerReview(review: CustomerReview): boolean {
  return review.reply === null && review.moderationStatus === 'PUBLISHED';
}

/** « Amine B. » : le nom de famille complet ne sort pas de l'agence. */
export function publicReviewAuthor(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0);
  return initial.length === 0
    ? firstName.trim()
    : `${firstName.trim()} ${initial.toLocaleUpperCase('fr')}.`;
}

/** Le client peut annuler une demande ou une réservation confirmée tant qu'il n'a pas pris la voiture. */
export function canCustomerCancel(status: BookingStatus, pickupAt: Date, now: Date): boolean {
  return (status === 'PENDING' || status === 'CONFIRMED') && pickupAt.getTime() > now.getTime();
}

export interface CustomerBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  pickupAt: string;
  returnAt: string;
  pickupLocation: LocalizedText;
  days: number;
  dailyRateMillimes: number;
  totalMillimes: number;
  depositMillimes: number;
  customerNote: string | null;
  createdAt: string;
  canCancel: boolean;
  review: CustomerReview | null;
  history: BookingEvent[];
  vehicle: {
    brand: string;
    model: string;
    /** Slug de la catégorie. */
    category: string;
    transmission: Transmission;
    seats: number;
    color: string;
  };
  agency: {
    name: string;
    logoUrl: string | null;
    phone: string;
    whatsappPhone: string;
    extraPhones: string[];
    address: string;
  };
}

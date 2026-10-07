import { z } from 'zod';

import type { BookingEvent } from './agency-portal';
import { type BookingStatus, type PaymentMethod, rentalDays } from './booking';
import { type DayKey, tunisDateTime } from './dates';
import type { LocalizedText } from './location';
import {
  type FuelType,
  type Transmission,
  type VehicleCategory,
  vehicleCategorySchema,
} from './vehicle';

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

// --- Recherche publique ----------------------------------------------------------

export const offerSearchSchema = z.object({
  /** Slug d'un lieu (aéroport, ville...) ; vide = toute la Tunisie. */
  location: z.string().trim().max(80).optional().catch(undefined),
  pickup: dayKeySchema.optional().catch(undefined),
  return: dayKeySchema.optional().catch(undefined),
  category: vehicleCategorySchema.optional().catch(undefined),
});

export type OfferSearch = z.infer<typeof offerSearchSchema>;

export interface OfferAgency {
  id: string;
  name: string;
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
  category: VehicleCategory;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  airConditioning: boolean;
  color: string;
  dailyRateMillimes: number;
  depositMillimes: number;
  /** `null` : kilométrage illimité. */
  mileageLimitKm: number | null;
  agency: OfferAgency;
}

export interface OfferSearchResult {
  offers: Offer[];
  /** Nombre de jours facturés si les deux dates sont fournies. */
  days: number | null;
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
  history: BookingEvent[];
  vehicle: {
    brand: string;
    model: string;
    category: VehicleCategory;
    transmission: Transmission;
    seats: number;
    color: string;
  };
  agency: {
    name: string;
    phone: string;
    whatsappPhone: string;
    address: string;
  };
}

import { z } from 'zod';

import type { AgencyProfile, RentalConditions } from './agency';
import {
  type BookingStatus,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  type PaymentKind,
  type PaymentMethod,
  type PaymentSummary,
} from './booking';
import { addDays, type DayKey, dayKeyToDate } from './dates';
import type { LocalizedText } from './location';
import {
  type VehicleInput,
  type VehiclePhoto,
  type VehicleStatus,
  vehicleStatusSchema,
} from './vehicle';

/** Formes des réponses de l'API agence (dates ISO 8601 en UTC, montants en millimes). */

export interface Vehicle extends VehicleInput {
  id: string;
  status: VehicleStatus;
  /** Dans l'ordre choisi par l'agence ; la première est la couverture. */
  photos: VehiclePhoto[];
  /** Couleur de carrosserie (hexadécimal), utilisée pour la vignette. */
  color: string;
  mileageKm: number;
  createdAt: string;
}

export interface BookingRef {
  id: string;
  reference: string;
  pickupAt: string;
  returnAt: string;
  status: BookingStatus;
  customerName: string;
}

export interface VehicleView extends Vehicle {
  /** Location en cours (véhicule sorti), le cas échéant. */
  currentBooking: BookingRef | null;
  nextBooking: BookingRef | null;
  /** Part des 30 derniers jours pendant laquelle le véhicule était loué (0 à 1). */
  occupancyRate: number;
  /** Chiffre d'affaires des réservations terminées sur 30 jours. */
  revenue30dMillimes: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  /** Numéro national tunisien à 8 chiffres. */
  phone: string;
  email: string | null;
  city: string;
  createdAt: string;
}

export interface CustomerView extends Customer {
  bookingsCount: number;
  completedCount: number;
  totalSpentMillimes: number;
  lastBookingAt: string | null;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amountMillimes: number;
  recordedAt: string;
  note: string | null;
}

export interface BookingEvent {
  status: BookingStatus;
  at: string;
  reason: string | null;
}

export interface Booking {
  id: string;
  reference: string;
  vehicleId: string;
  customerId: string;
  pickupAt: string;
  returnAt: string;
  pickupLocation: LocalizedText;
  returnLocation: LocalizedText;
  status: BookingStatus;
  dailyRateMillimes: number;
  totalMillimes: number;
  depositMillimes: number;
  customerNote: string | null;
  createdAt: string;
  history: BookingEvent[];
}

export interface BookingView extends Booking {
  vehicle: Vehicle;
  customer: Customer;
  payments: PaymentRecord[];
  payment: PaymentSummary;
  days: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const BOOKING_FILTERS = [
  'all',
  'pending',
  'confirmed',
  'ongoing',
  'completed',
  'cancelled',
] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export const BOOKING_SORTS = ['pickup_desc', 'pickup_asc', 'created_desc'] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

export interface BookingQuery {
  filter: BookingFilter;
  search: string;
  sort: BookingSort;
  page: number;
  /** Taille de page ; l'API applique `AGENCY_LIST_LIMIT_DEFAULT` si absente. */
  limit?: number;
}

export interface BookingList extends Paginated<BookingView> {
  counts: Record<BookingFilter, number>;
}

export interface DashboardKpis {
  revenueMonthMillimes: number;
  revenuePreviousMonthMillimes: number;
  bookingsMonth: number;
  bookingsPreviousMonth: number;
  /** Taux d'occupation de la flotte active sur 30 jours (0 à 1). */
  occupancyRate: number;
  outstandingMillimes: number;
}

export interface FleetBreakdown {
  available: number;
  onRent: number;
  maintenance: number;
  inactive: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  pending: BookingView[];
  pendingCount: number;
  departuresToday: BookingView[];
  returnsToday: BookingView[];
  revenueByMonth: { month: string; amountMillimes: number }[];
  fleet: FleetBreakdown;
  rating: { average: number; count: number };
}

/** Réservation du planning : barre et infobulle ; le détail se charge à part (`GET /bookings/:id`). */
export interface PlanningBooking {
  id: string;
  reference: string;
  vehicleId: string;
  status: BookingStatus;
  pickupAt: string;
  returnAt: string;
  totalMillimes: number;
  customer: Pick<Customer, 'id' | 'firstName' | 'lastName'>;
}

/** Fenêtre [from, to[ en jours de Tunis ; seules les réservations qui la chevauchent sont listées. */
export interface PlanningData {
  from: DayKey;
  to: DayKey;
  days: number;
  vehicles: Vehicle[];
  bookings: PlanningBooking[];
}

export interface CustomerQuery {
  search: string;
  page: number;
  limit?: number;
}

export interface CustomerDetail extends CustomerView {
  bookings: BookingView[];
}

export interface PaymentQuery {
  kind: PaymentKind | 'ALL';
  method: PaymentMethod | 'ALL';
  page: number;
  limit?: number;
}

export interface PaymentView extends PaymentRecord {
  bookingReference: string;
  customerName: string;
}

export interface PaymentSummaryTotals {
  collectedMonthMillimes: number;
  refundedMonthMillimes: number;
  outstandingMillimes: number;
  depositsHeldMillimes: number;
  /** Encaissements du mois par mode de paiement. */
  byMethod: Record<PaymentMethod, number>;
}

export interface PaymentList extends Paginated<PaymentView> {
  summary: PaymentSummaryTotals;
}

export interface Review {
  id: string;
  bookingId: string;
  customerName: string;
  vehicleName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
}

export const REVIEW_FILTERS = ['all', 'unanswered', 'positive', 'critical'] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export interface ReviewQuery {
  filter: ReviewFilter;
  page: number;
  limit?: number;
}

/** Page d'avis filtrés ; les statistiques portent sur tous les avis visibles de l'agence. */
export interface ReviewList extends Paginated<Review> {
  average: number;
  count: number;
  unansweredCount: number;
  /** Nombre d'avis par note, de 1 à 5 (index 0 = 1 étoile). */
  distribution: [number, number, number, number, number];
}

export interface AgencySettings {
  profile: AgencyProfile;
  conditions: RentalConditions;
  /** URL publique du logo, `null` sans logo. */
  logoUrl: string | null;
}

// --- Paramètres de requête (chaînes de l'URL, validées par l'API) -------------------

export const AGENCY_LIST_LIMIT_DEFAULT = 20;
export const AGENCY_LIST_LIMIT_MAX = 100;

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

/** Une taille invalide retombe sur la valeur par défaut ; au-delà du maximum, elle est plafonnée. */
const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .catch(AGENCY_LIST_LIMIT_DEFAULT)
  .transform((value) => Math.min(value, AGENCY_LIST_LIMIT_MAX));

export const bookingQuerySchema = z.object({
  filter: z.enum(BOOKING_FILTERS).catch('all'),
  search: z.string().trim().max(80).catch(''),
  sort: z.enum(BOOKING_SORTS).catch('pickup_desc'),
  page: pageSchema,
  limit: limitSchema,
}) satisfies z.ZodType<BookingQuery>;

export const customerQuerySchema = z.object({
  search: z.string().trim().max(80).catch(''),
  page: pageSchema,
  limit: limitSchema,
}) satisfies z.ZodType<CustomerQuery>;

export const paymentQuerySchema = z.object({
  kind: z.enum([...PAYMENT_KINDS, 'ALL']).catch('ALL'),
  method: z.enum([...PAYMENT_METHODS, 'ALL']).catch('ALL'),
  page: pageSchema,
  limit: limitSchema,
}) satisfies z.ZodType<PaymentQuery>;

export const reviewQuerySchema = z.object({
  filter: z.enum(REVIEW_FILTERS).catch('all'),
  page: pageSchema,
  limit: limitSchema,
}) satisfies z.ZodType<ReviewQuery>;

export const PLANNING_DAYS_DEFAULT = 14;
export const PLANNING_DAYS_MAX = 62;

function isDayKey(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(dayKeyToDate(value).getTime()) &&
    addDays(value, 0) === value
  );
}

const dayKeySchema = z.string().refine(isDayKey, { message: 'INVALID_DATE' });

/**
 * Tous facultatifs : `from` vaut la veille (jour de Tunis), la fin `to` (exclue) vaut
 * `from` + `days` (14 par défaut). La cohérence de la fenêtre (fin après le début, au plus
 * `PLANNING_DAYS_MAX` jours) est vérifiée par l'API, qui renvoie un message explicite.
 */
export const planningQuerySchema = z.object({
  from: dayKeySchema.optional(),
  to: dayKeySchema.optional(),
  days: z.coerce.number().int({ message: 'INVALID_DAYS' }).optional(),
});

export type PlanningQuery = z.output<typeof planningQuerySchema>;

export const reviewReplySchema = z.object({
  reply: z.string().trim().min(1, { message: 'REQUIRED' }).max(1000, { message: 'TOO_LONG' }),
});

export const vehicleStatusInputSchema = z.object({ status: vehicleStatusSchema });

export interface NavCounts {
  pendingBookings: number;
  unansweredReviews: number;
  latestPending: BookingView[];
}

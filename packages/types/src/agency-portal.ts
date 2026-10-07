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
import type { DayKey } from './dates';
import type { LocalizedText } from './location';
import { type VehicleInput, type VehicleStatus, vehicleStatusSchema } from './vehicle';

/** Formes des réponses de l'API agence (dates ISO 8601 en UTC, montants en millimes). */

export interface Vehicle extends VehicleInput {
  id: string;
  status: VehicleStatus;
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

export interface PlanningData {
  from: DayKey;
  days: number;
  vehicles: Vehicle[];
  bookings: BookingView[];
}

export interface CustomerQuery {
  search: string;
  page: number;
}

export interface CustomerDetail extends CustomerView {
  bookings: BookingView[];
}

export interface PaymentQuery {
  kind: PaymentKind | 'ALL';
  method: PaymentMethod | 'ALL';
  page: number;
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

export interface ReviewList {
  items: Review[];
  average: number;
  count: number;
  unansweredCount: number;
  /** Nombre d'avis par note, de 1 à 5 (index 0 = 1 étoile). */
  distribution: [number, number, number, number, number];
}

export interface AgencySettings {
  profile: AgencyProfile;
  conditions: RentalConditions;
}

// --- Paramètres de requête (chaînes de l'URL, validées par l'API) -------------------

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

export const bookingQuerySchema = z.object({
  filter: z.enum(BOOKING_FILTERS).catch('all'),
  search: z.string().trim().max(80).catch(''),
  sort: z.enum(BOOKING_SORTS).catch('pickup_desc'),
  page: pageSchema,
}) satisfies z.ZodType<BookingQuery>;

export const customerQuerySchema = z.object({
  search: z.string().trim().max(80).catch(''),
  page: pageSchema,
}) satisfies z.ZodType<CustomerQuery>;

export const paymentQuerySchema = z.object({
  kind: z.enum([...PAYMENT_KINDS, 'ALL']).catch('ALL'),
  method: z.enum([...PAYMENT_METHODS, 'ALL']).catch('ALL'),
  page: pageSchema,
}) satisfies z.ZodType<PaymentQuery>;

export const reviewQuerySchema = z.object({
  filter: z.enum(REVIEW_FILTERS).catch('all'),
});

export const PLANNING_DAYS_MAX = 62;

export const planningQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(PLANNING_DAYS_MAX),
});

export const reviewReplySchema = z.object({
  reply: z.string().trim().min(1, { message: 'REQUIRED' }).max(1000, { message: 'TOO_LONG' }),
});

export const vehicleStatusInputSchema = z.object({ status: vehicleStatusSchema });

export interface NavCounts {
  pendingBookings: number;
  unansweredReviews: number;
  latestPending: BookingView[];
}

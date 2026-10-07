import type {
  AgencyProfile,
  BookingStatus,
  LocalizedText,
  PaymentKind,
  PaymentMethod,
  PaymentSummary,
  RentalConditions,
  VehicleInput,
  VehicleStatus,
} from '@drivetn/types';

import type { DayKey } from './dates';

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

export interface NavCounts {
  pendingBookings: number;
  unansweredReviews: number;
  latestPending: BookingView[];
}

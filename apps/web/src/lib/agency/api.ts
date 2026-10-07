import type {
  AgencyProfileInput,
  BookingTransitionInput,
  RecordPaymentInput,
  RentalConditions,
  VehicleInput,
  VehicleStatus,
} from '@drivetn/types';

import type { DayKey } from './dates';
import { createMockAgencyApi } from './mock-api';
import type {
  AgencySettings,
  BookingList,
  BookingQuery,
  BookingView,
  CustomerDetail,
  CustomerQuery,
  CustomerView,
  DashboardData,
  NavCounts,
  Paginated,
  PaymentList,
  PaymentQuery,
  PlanningData,
  Review,
  ReviewFilter,
  ReviewList,
  VehicleView,
} from './types';

/**
 * Contrat de l'API du portail agence. Les écrans ne dépendent que de cette interface :
 * brancher l'API NestJS revient à fournir une implémentation basée sur `apiFetch`.
 */
export interface AgencyApi {
  /** Vrai pour l'implémentation de démonstration (données fictives en mémoire). */
  readonly isDemo: boolean;

  getDashboard(): Promise<DashboardData>;
  getNavCounts(): Promise<NavCounts>;

  listBookings(query: BookingQuery): Promise<BookingList>;
  getBooking(id: string): Promise<BookingView>;
  transitionBooking(id: string, input: BookingTransitionInput): Promise<BookingView>;
  recordPayment(bookingId: string, input: RecordPaymentInput): Promise<BookingView>;

  getPlanning(from: DayKey, days: number): Promise<PlanningData>;

  listVehicles(): Promise<VehicleView[]>;
  createVehicle(input: VehicleInput): Promise<VehicleView>;
  updateVehicle(id: string, input: VehicleInput): Promise<VehicleView>;
  setVehicleStatus(id: string, status: VehicleStatus): Promise<VehicleView>;

  listCustomers(query: CustomerQuery): Promise<Paginated<CustomerView>>;
  getCustomer(id: string): Promise<CustomerDetail>;

  listPayments(query: PaymentQuery): Promise<PaymentList>;

  listReviews(filter: ReviewFilter): Promise<ReviewList>;
  replyToReview(id: string, reply: string): Promise<Review>;

  getSettings(): Promise<AgencySettings>;
  updateProfile(input: AgencyProfileInput): Promise<AgencySettings>;
  updateConditions(input: RentalConditions): Promise<AgencySettings>;
}

/** Données de démonstration tant que les modules agence de l'API ne sont pas livrés. */
export const agencyApi: AgencyApi = createMockAgencyApi();

/** Vrai tant que le portail affiche des données de démonstration. */
export const AGENCY_DEMO_MODE = agencyApi.isDemo;

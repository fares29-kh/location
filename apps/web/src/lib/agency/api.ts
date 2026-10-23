import type {
  AgencyProfileInput,
  BookingTransitionInput,
  DeskBookingInput,
  RecordPaymentInput,
  ReviewReportInput,
  RentalConditions,
  VehicleInput,
  VehicleMaintenance,
  VehicleMaintenanceInput,
  VehiclePhoto,
  VehicleStatus,
} from '@drivetn/types';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

import type { DayKey } from './dates';
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
  ReviewList,
  ReviewQuery,
  VehicleView,
} from './types';

/**
 * Contrat de l'API du portail agence. Les écrans ne dépendent que de cette interface,
 * implémentée par les routes `/api/v1/agency/*`.
 */
export interface AgencyApi {
  /** Vrai pour une implémentation de démonstration (données fictives en mémoire). */
  readonly isDemo: boolean;

  getDashboard(): Promise<DashboardData>;
  getNavCounts(): Promise<NavCounts>;

  listBookings(query: BookingQuery): Promise<BookingList>;
  createBooking(input: DeskBookingInput): Promise<BookingView>;
  getBooking(id: string): Promise<BookingView>;
  transitionBooking(id: string, input: BookingTransitionInput): Promise<BookingView>;
  recordPayment(bookingId: string, input: RecordPaymentInput): Promise<BookingView>;

  getPlanning(from: DayKey, days: number): Promise<PlanningData>;

  listVehicles(): Promise<VehicleView[]>;
  createVehicle(input: VehicleInput): Promise<VehicleView>;
  updateVehicle(id: string, input: VehicleInput): Promise<VehicleView>;
  setVehicleStatus(id: string, status: VehicleStatus): Promise<VehicleView>;
  deleteVehicle(id: string): Promise<void>;
  addMaintenance(vehicleId: string, input: VehicleMaintenanceInput): Promise<VehicleMaintenance>;
  removeMaintenance(vehicleId: string, maintenanceId: string): Promise<void>;
  uploadVehiclePhoto(vehicleId: string, file: File): Promise<VehiclePhoto>;
  deleteVehiclePhoto(vehicleId: string, photoId: string): Promise<void>;
  reorderVehiclePhotos(vehicleId: string, photoIds: string[]): Promise<VehiclePhoto[]>;

  listCustomers(query: CustomerQuery): Promise<Paginated<CustomerView>>;
  getCustomer(id: string): Promise<CustomerDetail>;

  listPayments(query: PaymentQuery): Promise<PaymentList>;

  listReviews(query: ReviewQuery): Promise<ReviewList>;
  replyToReview(id: string, reply: string): Promise<Review>;
  reportReview(id: string, reason: ReviewReportInput['reason']): Promise<Review>;

  getSettings(): Promise<AgencySettings>;
  updateProfile(input: AgencyProfileInput): Promise<AgencySettings>;
  updateConditions(input: RentalConditions): Promise<AgencySettings>;
  uploadLogo(file: File): Promise<AgencySettings>;
  removeLogo(): Promise<AgencySettings>;
}

/** Réponse typée par le contrat partagé `@drivetn/types` (l'API valide ses propres sorties). */
function shape<T>() {
  return z.custom<T>(() => true);
}

function withQuery(path: string, params: Record<string, string | number>): string {
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return `${path}?${search.toString()}`;
}

const segment = encodeURIComponent;
/** Une photo de 10 Mo sur une connexion mobile lente. */
const PHOTO_UPLOAD_TIMEOUT_MS = 120_000;

function createHttpAgencyApi(): AgencyApi {
  return {
    isDemo: false,

    getDashboard: () => apiFetch('/agency/dashboard', { schema: shape<DashboardData>() }),
    getNavCounts: () => apiFetch('/agency/nav-counts', { schema: shape<NavCounts>() }),

    listBookings: (query) =>
      apiFetch(withQuery('/agency/bookings', { ...query }), { schema: shape<BookingList>() }),
    createBooking: (input) =>
      apiFetch('/agency/bookings', { method: 'POST', body: input, schema: shape<BookingView>() }),
    getBooking: (id) =>
      apiFetch(`/agency/bookings/${segment(id)}`, { schema: shape<BookingView>() }),
    transitionBooking: (id, input) =>
      apiFetch(`/agency/bookings/${segment(id)}/transition`, {
        method: 'POST',
        body: input,
        schema: shape<BookingView>(),
      }),
    recordPayment: (bookingId, input) =>
      apiFetch(`/agency/bookings/${segment(bookingId)}/payments`, {
        method: 'POST',
        body: input,
        schema: shape<BookingView>(),
      }),

    getPlanning: (from, days) =>
      apiFetch(withQuery('/agency/planning', { from, days }), { schema: shape<PlanningData>() }),

    listVehicles: () => apiFetch('/agency/vehicles', { schema: shape<VehicleView[]>() }),
    createVehicle: (input) =>
      apiFetch('/agency/vehicles', { method: 'POST', body: input, schema: shape<VehicleView>() }),
    updateVehicle: (id, input) =>
      apiFetch(`/agency/vehicles/${segment(id)}`, {
        method: 'PUT',
        body: input,
        schema: shape<VehicleView>(),
      }),
    setVehicleStatus: (id, status) =>
      apiFetch(`/agency/vehicles/${segment(id)}/status`, {
        method: 'PATCH',
        body: { status },
        schema: shape<VehicleView>(),
      }),
    deleteVehicle: (id) => apiFetch(`/agency/vehicles/${segment(id)}`, { method: 'DELETE' }),
    addMaintenance: (vehicleId, input) =>
      apiFetch(`/agency/vehicles/${segment(vehicleId)}/maintenances`, {
        method: 'POST',
        body: input,
        schema: shape<VehicleMaintenance>(),
      }),
    removeMaintenance: (vehicleId, maintenanceId) =>
      apiFetch(`/agency/vehicles/${segment(vehicleId)}/maintenances/${segment(maintenanceId)}`, {
        method: 'DELETE',
      }),
    uploadVehiclePhoto: (vehicleId, file) => {
      const body = new FormData();
      body.append('file', file);
      return apiFetch(`/agency/vehicles/${segment(vehicleId)}/photos`, {
        method: 'POST',
        body,
        schema: shape<VehiclePhoto>(),
        timeoutMs: PHOTO_UPLOAD_TIMEOUT_MS,
      });
    },
    deleteVehiclePhoto: (vehicleId, photoId) =>
      apiFetch(`/agency/vehicles/${segment(vehicleId)}/photos/${segment(photoId)}`, {
        method: 'DELETE',
      }),
    reorderVehiclePhotos: (vehicleId, photoIds) =>
      apiFetch(`/agency/vehicles/${segment(vehicleId)}/photos/order`, {
        method: 'PUT',
        body: { photoIds },
        schema: shape<VehiclePhoto[]>(),
      }),

    listCustomers: (query) =>
      apiFetch(withQuery('/agency/customers', { ...query }), {
        schema: shape<Paginated<CustomerView>>(),
      }),
    getCustomer: (id) =>
      apiFetch(`/agency/customers/${segment(id)}`, { schema: shape<CustomerDetail>() }),

    listPayments: (query) =>
      apiFetch(withQuery('/agency/payments', { ...query }), { schema: shape<PaymentList>() }),

    listReviews: (query) =>
      apiFetch(withQuery('/agency/reviews', { ...query }), { schema: shape<ReviewList>() }),
    replyToReview: (id, reply) =>
      apiFetch(`/agency/reviews/${segment(id)}/reply`, {
        method: 'POST',
        body: { reply },
        schema: shape<Review>(),
      }),
    reportReview: (id, reason) =>
      apiFetch(`/agency/reviews/${segment(id)}/report`, {
        method: 'POST',
        body: { reason },
        schema: shape<Review>(),
      }),

    getSettings: () => apiFetch('/agency/settings', { schema: shape<AgencySettings>() }),
    updateProfile: (input) =>
      apiFetch('/agency/settings/profile', {
        method: 'PUT',
        body: input,
        schema: shape<AgencySettings>(),
      }),
    updateConditions: (input) =>
      apiFetch('/agency/settings/conditions', {
        method: 'PUT',
        body: input,
        schema: shape<AgencySettings>(),
      }),
    uploadLogo: (file) => {
      const body = new FormData();
      body.append('file', file);
      return apiFetch('/agency/settings/logo', {
        method: 'PUT',
        body,
        schema: shape<AgencySettings>(),
        timeoutMs: PHOTO_UPLOAD_TIMEOUT_MS,
      });
    },
    removeLogo: () =>
      apiFetch('/agency/settings/logo', { method: 'DELETE', schema: shape<AgencySettings>() }),
  };
}

export const agencyApi: AgencyApi = createHttpAgencyApi();

/** Vrai tant que le portail affiche des données de démonstration. */
export const AGENCY_DEMO_MODE = agencyApi.isDemo;

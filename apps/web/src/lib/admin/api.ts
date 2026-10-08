import type {
  AgencyDecisionInput,
  PaymentMethod,
  PlatformSettings,
  ReviewModerationInput,
  UserStatusInput,
} from '@drivetn/types';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

import type {
  AdminDashboard,
  AdminNavCounts,
  Agency,
  AgencyDetail,
  AgencyList,
  AgencyQuery,
  AuditEntry,
  AuditQuery,
  BookingList,
  BookingQuery,
  Invoice,
  InvoiceList,
  InvoiceQuery,
  ModeratedReview,
  Paginated,
  PlatformUser,
  ReviewList,
  ReviewQuery,
  UserDetail,
  UserList,
  UserQuery,
} from './types';

/**
 * Contrat de l'API du portail d'administration. Les écrans ne dépendent que de cette interface,
 * implémentée par les routes `/api/v1/admin/*`.
 */
export interface AdminApi {
  getDashboard(): Promise<AdminDashboard>;
  getNavCounts(): Promise<AdminNavCounts>;

  listAgencies(query: AgencyQuery): Promise<AgencyList>;
  getAgency(id: string): Promise<AgencyDetail>;
  decideAgency(id: string, input: AgencyDecisionInput): Promise<Agency>;

  listUsers(query: UserQuery): Promise<UserList>;
  getUser(id: string): Promise<UserDetail>;
  setUserStatus(id: string, input: UserStatusInput): Promise<PlatformUser>;

  listBookings(query: BookingQuery): Promise<BookingList>;

  listInvoices(query: InvoiceQuery): Promise<InvoiceList>;
  getInvoice(id: string): Promise<Invoice>;
  markInvoicePaid(id: string, method: PaymentMethod): Promise<Invoice>;
  sendInvoiceReminder(id: string): Promise<Invoice>;

  listReviews(query: ReviewQuery): Promise<ReviewList>;
  moderateReview(id: string, input: ReviewModerationInput): Promise<ModeratedReview>;

  listAudit(query: AuditQuery): Promise<Paginated<AuditEntry>>;

  getSettings(): Promise<PlatformSettings>;
  updateSettings(input: PlatformSettings): Promise<PlatformSettings>;
}

/** Réponse typée par le contrat partagé `@drivetn/types` (l'API valide ses propres entrées). */
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

function post<T>(path: string, body?: unknown) {
  return apiFetch(path, { method: 'POST', body, schema: shape<T>() });
}

function createHttpAdminApi(): AdminApi {
  return {
    getDashboard: () => apiFetch('/admin/dashboard', { schema: shape<AdminDashboard>() }),
    getNavCounts: () => apiFetch('/admin/nav-counts', { schema: shape<AdminNavCounts>() }),

    listAgencies: (query) =>
      apiFetch(withQuery('/admin/agencies', { ...query }), { schema: shape<AgencyList>() }),
    getAgency: (id) =>
      apiFetch(`/admin/agencies/${segment(id)}`, { schema: shape<AgencyDetail>() }),
    decideAgency: (id, input) => post<Agency>(`/admin/agencies/${segment(id)}/decision`, input),

    listUsers: (query) =>
      apiFetch(withQuery('/admin/users', { ...query }), { schema: shape<UserList>() }),
    getUser: (id) => apiFetch(`/admin/users/${segment(id)}`, { schema: shape<UserDetail>() }),
    setUserStatus: (id, input) => post<PlatformUser>(`/admin/users/${segment(id)}/status`, input),

    listBookings: (query) =>
      apiFetch(withQuery('/admin/bookings', { ...query }), { schema: shape<BookingList>() }),

    listInvoices: (query) =>
      apiFetch(withQuery('/admin/invoices', { ...query }), { schema: shape<InvoiceList>() }),
    getInvoice: (id) => apiFetch(`/admin/invoices/${segment(id)}`, { schema: shape<Invoice>() }),
    markInvoicePaid: (id, method) =>
      post<Invoice>(`/admin/invoices/${segment(id)}/payment`, { method }),
    sendInvoiceReminder: (id) => post<Invoice>(`/admin/invoices/${segment(id)}/reminder`),

    listReviews: (query) =>
      apiFetch(withQuery('/admin/reviews', { ...query }), { schema: shape<ReviewList>() }),
    moderateReview: (id, input) =>
      post<ModeratedReview>(`/admin/reviews/${segment(id)}/moderation`, input),

    listAudit: (query) =>
      apiFetch(withQuery('/admin/audit', { ...query }), {
        schema: shape<Paginated<AuditEntry>>(),
      }),

    getSettings: () => apiFetch('/admin/settings', { schema: shape<PlatformSettings>() }),
    updateSettings: (input) =>
      apiFetch('/admin/settings', {
        method: 'PUT',
        body: input,
        schema: shape<PlatformSettings>(),
      }),
  };
}

export const adminApi: AdminApi = createHttpAdminApi();

import type {
  AgencyDecisionInput,
  PaymentMethod,
  PlatformSettings,
  ReviewModerationInput,
  UserStatusInput,
} from '@drivetn/types';

import { createMockAdminApi } from './mock-api';
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
 * Contrat de l'API du portail d'administration. Les écrans ne dépendent que de cette interface :
 * brancher l'API NestJS revient à fournir une implémentation basée sur `apiFetch`.
 */
export interface AdminApi {
  /** Vrai pour l'implémentation de démonstration (données fictives en mémoire). */
  readonly isDemo: boolean;

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

const mockAdminApi = createMockAdminApi();

/** Données de démonstration tant que les modules d'administration de l'API ne sont pas livrés. */
export const adminApi: AdminApi = mockAdminApi;

/** Vrai tant que le portail affiche des données de démonstration. */
export const ADMIN_DEMO_MODE = adminApi.isDemo;

/** Rattache les actions de démonstration (journal d'audit, droits) à l'administrateur connecté. */
export const identifyDemoAdmin = mockAdminApi.identify;

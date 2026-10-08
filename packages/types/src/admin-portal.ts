import { z } from 'zod';

import type { Paginated } from './agency-portal';
import type { AdminRole, UserRole, UserStatus } from './auth';
import {
  type BookingStatus,
  type PaymentMethod,
  paymentMethodSchema,
  type PaymentStatus,
} from './booking';
import type {
  AgencyDocumentKind,
  AgencyStatus,
  InvoiceStatus,
  ReviewModerationStatus,
  ReviewReportReason,
  SubscriptionPlan,
} from './platform';

export const ADMIN_PAGE_SIZE = 10;
export const ADMIN_AUDIT_PAGE_SIZE = 20;

/** Libellé minimal d'une agence, repris dans les listes des autres modules. */
export interface AgencyRef {
  id: string;
  name: string;
  city: string;
}

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);
const searchSchema = z.string().trim().max(80).catch('');

// --- Agences ----------------------------------------------------------------------

export interface AgencyDocument {
  kind: AgencyDocumentKind;
  /** Date de dépôt (`null` = pièce manquante). */
  uploadedAt: string | null;
}

export interface AdminAgency extends AgencyRef {
  status: AgencyStatus;
  owner: PersonRef;
  phone: string;
  email: string | null;
  address: string;
  /** Matricule fiscal (ex. 1234567/A/M/000). */
  taxId: string;
  plan: SubscriptionPlan;
  /** Commission propre à l'agence (`null` = commission par défaut de la plateforme). */
  commissionBps: number | null;
  vehiclesCount: number;
  bookingsCount: number;
  gmvMonthMillimes: number;
  rating: { average: number; count: number };
  documents: AgencyDocument[];
  createdAt: string;
  /** Dernière décision de l'administration (validation, refus, suspension…). */
  decidedAt: string | null;
  statusReason: string | null;
}

export const ADMIN_AGENCY_FILTERS = ['all', 'pending', 'active', 'suspended', 'rejected'] as const;
export type AdminAgencyFilter = (typeof ADMIN_AGENCY_FILTERS)[number];

export const ADMIN_AGENCY_FILTER_STATUSES: Record<
  Exclude<AdminAgencyFilter, 'all'>,
  AgencyStatus
> = {
  pending: 'PENDING_REVIEW',
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  rejected: 'REJECTED',
};

export interface AdminAgencyQuery {
  search: string;
  filter: AdminAgencyFilter;
  page: number;
}

export const adminAgencyQuerySchema = z.object({
  search: searchSchema,
  filter: z.enum(ADMIN_AGENCY_FILTERS).catch('all'),
  page: pageSchema,
}) satisfies z.ZodType<AdminAgencyQuery>;

export interface AdminAgencyList extends Paginated<AdminAgency> {
  counts: Record<AdminAgencyFilter, number>;
}

export interface AdminAgencyDetail extends AdminAgency {
  recentBookings: PlatformBooking[];
  invoices: Invoice[];
  activity: AdminAuditEntry[];
}

// --- Utilisateurs -------------------------------------------------------------------

export interface PlatformUser extends PersonRef {
  role: UserRole;
  adminRole: AdminRole | null;
  status: UserStatus;
  agency: AgencyRef | null;
  bookingsCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  statusReason: string | null;
}

export const USER_FILTERS = ['all', 'customers', 'agency', 'admins', 'suspended'] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export interface UserQuery {
  search: string;
  filter: UserFilter;
  page: number;
}

export const userQuerySchema = z.object({
  search: searchSchema,
  filter: z.enum(USER_FILTERS).catch('all'),
  page: pageSchema,
}) satisfies z.ZodType<UserQuery>;

export interface UserList extends Paginated<PlatformUser> {
  counts: Record<UserFilter, number>;
}

export interface UserDetail extends PlatformUser {
  activity: AdminAuditEntry[];
}

// --- Réservations ---------------------------------------------------------------

export interface PlatformBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  agency: AgencyRef;
  customer: PersonRef;
  vehicle: { brand: string; model: string; plateNumber: string };
  pickupAt: string;
  returnAt: string;
  pickupLocation: string;
  totalMillimes: number;
  createdAt: string;
}

export const PLATFORM_BOOKING_FILTERS = [
  'all',
  'pending',
  'active',
  'completed',
  'cancelled',
] as const;
export type PlatformBookingFilter = (typeof PLATFORM_BOOKING_FILTERS)[number];

export const PLATFORM_BOOKING_FILTER_STATUSES: Record<
  Exclude<PlatformBookingFilter, 'all'>,
  readonly BookingStatus[]
> = {
  pending: ['PENDING'],
  active: ['CONFIRMED', 'PICKED_UP', 'RETURNED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED'],
};

export interface PlatformBookingQuery {
  search: string;
  filter: PlatformBookingFilter;
  page: number;
}

export const platformBookingQuerySchema = z.object({
  search: searchSchema,
  filter: z.enum(PLATFORM_BOOKING_FILTERS).catch('all'),
  page: pageSchema,
}) satisfies z.ZodType<PlatformBookingQuery>;

export interface PlatformBookingList extends Paginated<PlatformBooking> {
  counts: Record<PlatformBookingFilter, number>;
  /** Demandes restées sans réponse au-delà du délai d'expiration. */
  stalePending: number;
}

// --- Facturation ----------------------------------------------------------------

export interface Invoice {
  id: string;
  number: string;
  agency: AgencyRef;
  /** Mois facturé (« AAAA-MM »). */
  period: string;
  plan: SubscriptionPlan;
  subscriptionMillimes: number;
  commissionMillimes: number;
  subtotalMillimes: number;
  vatRateBps: number;
  vatMillimes: number;
  fiscalStampMillimes: number;
  totalMillimes: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  remindedAt: string | null;
}

/** Statut d'une facture : réglée, en retard après l'échéance, sinon émise. */
export function invoiceStatus(
  invoice: { paidAt: Date | string | null; dueAt: Date | string },
  now: Date,
): InvoiceStatus {
  if (invoice.paidAt !== null) {
    return 'PAID';
  }
  return new Date(invoice.dueAt).getTime() < now.getTime() ? 'OVERDUE' : 'ISSUED';
}

export const INVOICE_FILTERS = ['all', 'issued', 'overdue', 'paid'] as const;
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number];

export interface InvoiceQuery {
  search: string;
  filter: InvoiceFilter;
  page: number;
}

export const invoiceQuerySchema = z.object({
  search: searchSchema,
  filter: z.enum(INVOICE_FILTERS).catch('all'),
  page: pageSchema,
}) satisfies z.ZodType<InvoiceQuery>;

export interface BillingOverview {
  /** Revenu mensuel récurrent (abonnements actifs, HT). */
  mrrMillimes: number;
  collectedMonthMillimes: number;
  outstandingMillimes: number;
  overdueMillimes: number;
  plans: { plan: SubscriptionPlan; agencies: number }[];
}

export interface InvoiceList extends Paginated<Invoice> {
  counts: Record<InvoiceFilter, number>;
  overview: BillingOverview;
}

// --- Avis ------------------------------------------------------------------------

export interface ModeratedReview {
  id: string;
  agency: AgencyRef;
  author: { firstName: string; lastName: string };
  rating: number;
  comment: string;
  agencyReply: string | null;
  status: ReviewModerationStatus;
  reports: { reason: ReviewReportReason; count: number }[];
  createdAt: string;
  moderatedAt: string | null;
  moderationReason: string | null;
}

export const MODERATION_FILTERS = ['flagged', 'published', 'hidden', 'all'] as const;
export type ModerationFilter = (typeof MODERATION_FILTERS)[number];

export interface ModerationQuery {
  filter: ModerationFilter;
  page: number;
}

export const moderationQuerySchema = z.object({
  filter: z.enum(MODERATION_FILTERS).catch('flagged'),
  page: pageSchema,
}) satisfies z.ZodType<ModerationQuery>;

export interface ModeratedReviewList extends Paginated<ModeratedReview> {
  counts: Record<ModerationFilter, number>;
}

// --- Journal d'audit ------------------------------------------------------------

/** Actions tracées dans le journal d'audit (API et administration). */
export const AUDIT_ACTIONS = [
  'auth.signup',
  'auth.phone_verified',
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.password_reset',
  'auth.password_changed',
  'auth.refresh_token_reused',
  'agency.created',
  'agency.approved',
  'agency.rejected',
  'agency.suspended',
  'agency.reactivated',
  'user.suspended',
  'user.reactivated',
  'booking.created',
  'booking.status_changed',
  'booking.cancelled_by_customer',
  'payment.recorded',
  'invoice.issued',
  'invoice.paid',
  'invoice.reminder_sent',
  'review.published',
  'review.hidden',
  'settings.updated',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export const AUDIT_CATEGORIES = [
  'auth',
  'agency',
  'user',
  'booking',
  'payment',
  'invoice',
  'review',
  'settings',
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export function auditCategory(action: AuditAction): AuditCategory {
  return action.slice(0, action.indexOf('.')) as AuditCategory;
}

export interface AuditActor {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AdminAuditEntry {
  id: string;
  action: AuditAction;
  /** `null` pour une action du système (tâche planifiée). */
  actor: AuditActor | null;
  /** Libellé lisible de l'élément concerné (agence, compte, facture…). */
  target: string | null;
  /** Motif ou détail saisi lors de l'action. */
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditQuery {
  search: string;
  category: AuditCategory | 'all';
  page: number;
}

export const auditQuerySchema = z.object({
  search: searchSchema,
  category: z.enum([...AUDIT_CATEGORIES, 'all']).catch('all'),
  page: pageSchema,
}) satisfies z.ZodType<AuditQuery>;

// --- Tableau de bord ----------------------------------------------------------

export interface AdminDashboard {
  kpis: {
    gmvMonthMillimes: number;
    gmvPreviousMonthMillimes: number;
    bookingsMonth: number;
    bookingsPreviousMonth: number;
    activeAgencies: number;
    newAgenciesMonth: number;
    customers: number;
    newCustomersMonth: number;
  };
  gmvByMonth: { month: string; amountMillimes: number; bookings: number }[];
  pendingAgencies: AdminAgency[];
  topAgencies: { agency: AgencyRef; gmvMillimes: number; bookings: number }[];
  bookingStatus: { status: BookingStatus; count: number }[];
  recentActivity: AdminAuditEntry[];
  billing: { mrrMillimes: number; outstandingMillimes: number; overdueInvoices: number };
}

export interface AdminNavCounts {
  pendingAgencies: number;
  flaggedReviews: number;
  overdueInvoices: number;
}

// --- Actions -----------------------------------------------------------------

export const markInvoicePaidSchema = z.object({ method: paymentMethodSchema });
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidSchema>;

import type {
  AdminRole,
  AgencyDocumentKind,
  AgencyStatus,
  BookingStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  ReviewModerationStatus,
  ReviewReportReason,
  SubscriptionPlan,
  UserRole,
  UserStatus,
} from '@drivetn/types';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

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

// --- Agences ----------------------------------------------------------------------

export interface AgencyDocument {
  kind: AgencyDocumentKind;
  /** Date de dépôt (`null` = pièce manquante). */
  uploadedAt: string | null;
}

export interface Agency extends AgencyRef {
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

export type AgencyFilter = 'all' | 'pending' | 'active' | 'suspended' | 'rejected';

export interface AgencyQuery {
  search: string;
  filter: AgencyFilter;
  page: number;
}

export interface AgencyList extends Paginated<Agency> {
  counts: Record<AgencyFilter, number>;
}

export interface AgencyDetail extends Agency {
  recentBookings: PlatformBooking[];
  invoices: Invoice[];
  activity: AuditEntry[];
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

export type UserFilter = 'all' | 'customers' | 'agency' | 'admins' | 'suspended';

export interface UserQuery {
  search: string;
  filter: UserFilter;
  page: number;
}

export interface UserList extends Paginated<PlatformUser> {
  counts: Record<UserFilter, number>;
}

export interface UserDetail extends PlatformUser {
  activity: AuditEntry[];
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

export type BookingFilter = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';

export interface BookingQuery {
  search: string;
  filter: BookingFilter;
  page: number;
}

export interface BookingList extends Paginated<PlatformBooking> {
  counts: Record<BookingFilter, number>;
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

export type InvoiceFilter = 'all' | 'issued' | 'overdue' | 'paid';

export interface InvoiceQuery {
  search: string;
  filter: InvoiceFilter;
  page: number;
}

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

export type ReviewFilter = 'flagged' | 'published' | 'hidden' | 'all';

export interface ReviewQuery {
  filter: ReviewFilter;
  page: number;
}

export interface ReviewList extends Paginated<ModeratedReview> {
  counts: Record<ReviewFilter, number>;
}

// --- Journal d'audit ------------------------------------------------------------

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.signup',
  'auth.password_reset',
  'auth.password_changed',
  'agency.approved',
  'agency.rejected',
  'agency.suspended',
  'agency.reactivated',
  'user.suspended',
  'user.reactivated',
  'invoice.issued',
  'invoice.paid',
  'invoice.reminder_sent',
  'review.published',
  'review.hidden',
  'settings.updated',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_CATEGORIES = [
  'auth',
  'agency',
  'user',
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

export interface AuditEntry {
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
  pendingAgencies: Agency[];
  topAgencies: { agency: AgencyRef; gmvMillimes: number; bookings: number }[];
  bookingStatus: { status: BookingStatus; count: number }[];
  recentActivity: AuditEntry[];
  billing: { mrrMillimes: number; outstandingMillimes: number; overdueInvoices: number };
}

export interface AdminNavCounts {
  pendingAgencies: number;
  flaggedReviews: number;
  overdueInvoices: number;
}

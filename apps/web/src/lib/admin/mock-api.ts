import {
  type AgencyDecision,
  agencyDecisionInputSchema,
  applyAgencyDecision,
  BOOKING_STATUSES,
  type BookingStatus,
  type CurrentUser,
  getAgencyDecisions,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PlatformSettings,
  platformSettingsSchema,
  reviewModerationInputSchema,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
  userStatusInputSchema,
} from '@drivetn/types';
import type { z } from 'zod';

import { addMonths, toDayKey, todayKey, toMonthKey } from '@/lib/agency/dates';
import { ApiError } from '@/lib/api/errors';

import type { AdminApi } from './api';
import { type AdminDataset, createAdminDataset } from './mock-data';
import { type AdminPermission, hasAdminPermission } from './permissions';
import {
  type Agency,
  type AgencyFilter,
  type AuditAction,
  type AuditActor,
  auditCategory,
  type BookingFilter,
  type Invoice,
  type InvoiceFilter,
  type ModeratedReview,
  type Paginated,
  type PlatformUser,
  type ReviewFilter,
  type UserFilter,
} from './types';

const LATENCY_MS = 320;
const PAGE_SIZE = 10;
const AUDIT_PAGE_SIZE = 20;
const HOUR_MS = 3_600_000;

const AGENCY_FILTER_STATUSES: Record<Exclude<AgencyFilter, 'all'>, Agency['status']> = {
  pending: 'PENDING_REVIEW',
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  rejected: 'REJECTED',
};

const BOOKING_FILTER_STATUSES: Record<Exclude<BookingFilter, 'all'>, readonly BookingStatus[]> = {
  pending: ['PENDING'],
  active: ['CONFIRMED', 'PICKED_UP', 'RETURNED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED'],
};

const RENTED_STATUSES: readonly BookingStatus[] = ['PICKED_UP', 'RETURNED', 'COMPLETED'];

const DECISION_ACTIONS: Record<AgencyDecision, AuditAction> = {
  APPROVE: 'agency.approved',
  REJECT: 'agency.rejected',
  SUSPEND: 'agency.suspended',
  REACTIVATE: 'agency.reactivated',
};

/** `untilDay` limite au même quantième, pour comparer un mois en cours au précédent. */
function inMonth(value: string, monthKey: string, untilDay = 31): boolean {
  const day = toDayKey(value);
  return day.startsWith(monthKey) && Number(day.slice(8, 10)) <= untilDay;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matches(search: string, ...fields: (string | null)[]): boolean {
  const needle = normalize(search);
  return (
    needle.length === 0 ||
    fields.some((field) => field !== null && normalize(field).includes(needle))
  );
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): Paginated<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    total: items.length,
    page: current,
    pageSize,
    pageCount,
  };
}

function countBy<F extends string, T>(
  items: readonly T[],
  filters: readonly F[],
  test: (item: T, filter: F) => boolean,
): Record<F, number> {
  return Object.fromEntries(
    filters.map((filter) => [filter, items.filter((item) => test(item, filter)).length]),
  ) as Record<F, number>;
}

function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

function percent(bps: number): string {
  return `${String(bps / 100)} %`;
}

/** Résumé lisible de chaque paramètre, pour tracer les modifications dans le journal. */
function describeSettings(settings: PlatformSettings): Record<keyof PlatformSettings, string> {
  return {
    vatRateBps: `TVA ${percent(settings.vatRateBps)}`,
    fiscalStampMillimes: `Timbre ${String(settings.fiscalStampMillimes / 1000)} DT`,
    defaultCommissionBps: `Commission ${percent(settings.defaultCommissionBps)}`,
    bookingExpiryHours: `Expiration ${String(settings.bookingExpiryHours)} h`,
    supportPhone: `Support +216 ${settings.supportPhone}`,
    supportEmail: `Support ${settings.supportEmail}`,
  };
}

export interface MockAdminApi extends AdminApi {
  /** Associe les actions de démonstration à l'administrateur connecté (journal, droits). */
  identify: (user: CurrentUser) => void;
}

export function createMockAdminApi(): MockAdminApi {
  let dataset: AdminDataset | null = null;
  const db = (): AdminDataset => (dataset ??= createAdminDataset());
  let session: CurrentUser | null = null;

  async function respond<T>(compute: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS * (0.6 + Math.random() * 0.8)));
    return structuredClone(compute());
  }

  function authorize(permission: AdminPermission): AuditActor {
    if (session === null || !hasAdminPermission(session.adminRole, permission)) {
      throw new ApiError(403, 'FORBIDDEN', 'Insufficient admin role');
    }
    return {
      id: session.id,
      firstName: session.firstName,
      lastName: session.lastName,
      role: session.role,
    };
  }

  function log(
    action: AuditAction,
    actor: AuditActor,
    target: string | null,
    detail: string | null,
  ) {
    const { audit } = db();
    audit.unshift({
      id: `aud_live_${String(audit.length + 1)}`,
      action,
      actor,
      target,
      detail,
      ip: '197.2.14.120',
      createdAt: new Date().toISOString(),
    });
  }

  function find<T extends { id: string }>(items: T[], id: string, label: string): T {
    const found = items.find((item) => item.id === id);
    if (found === undefined) {
      throw new ApiError(404, 'NOT_FOUND', `${label} not found`);
    }
    return found;
  }

  function unpaid(invoice: Invoice): boolean {
    return invoice.status !== 'PAID';
  }

  function isStale(createdAt: string, now: number): boolean {
    return now - Date.parse(createdAt) > db().settings.bookingExpiryHours * HOUR_MS;
  }

  return {
    isDemo: true,

    identify: (user) => {
      session = user;
    },

    getDashboard: () =>
      respond(() => {
        const { agencies, users, bookings, invoices, audit } = db();
        const now = new Date();
        const month = toMonthKey(now);
        const previous = addMonths(month, -1);
        const dayOfMonth = Number(todayKey(now).slice(8, 10));
        const rented = bookings.filter((booking) => RENTED_STATUSES.includes(booking.status));
        const gmvOf = (key: string, untilDay?: number) =>
          rented
            .filter((booking) => inMonth(booking.pickupAt, key, untilDay))
            .reduce((sum, booking) => sum + booking.totalMillimes, 0);
        const createdIn = (key: string, untilDay?: number) =>
          bookings.filter((booking) => inMonth(booking.createdAt, key, untilDay)).length;
        const customers = users.filter((user) => user.role === 'CUSTOMER');
        const monthBookings = bookings.filter((booking) => toMonthKey(booking.pickupAt) === month);

        return {
          kpis: {
            gmvMonthMillimes: gmvOf(month),
            gmvPreviousMonthMillimes: gmvOf(previous, dayOfMonth),
            bookingsMonth: createdIn(month),
            bookingsPreviousMonth: createdIn(previous, dayOfMonth),
            activeAgencies: agencies.filter((agency) => agency.status === 'ACTIVE').length,
            newAgenciesMonth: agencies.filter((agency) => toMonthKey(agency.createdAt) === month)
              .length,
            customers: customers.length,
            newCustomersMonth: customers.filter((user) => toMonthKey(user.createdAt) === month)
              .length,
          },
          gmvByMonth: Array.from({ length: 6 }, (_, index) => {
            const key = addMonths(month, index - 5);
            return {
              month: key,
              amountMillimes: gmvOf(key),
              bookings: rented.filter((booking) => toMonthKey(booking.pickupAt) === key).length,
            };
          }),
          pendingAgencies: agencies
            .filter((agency) => agency.status === 'PENDING_REVIEW')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          topAgencies: agencies
            .filter((agency) => agency.gmvMonthMillimes > 0)
            .sort((a, b) => b.gmvMonthMillimes - a.gmvMonthMillimes)
            .slice(0, 5)
            .map((agency) => ({
              agency: { id: agency.id, name: agency.name, city: agency.city },
              gmvMillimes: agency.gmvMonthMillimes,
              bookings: monthBookings.filter(
                (booking) =>
                  booking.agency.id === agency.id && RENTED_STATUSES.includes(booking.status),
              ).length,
            })),
          bookingStatus: BOOKING_STATUSES.map((status) => ({
            status,
            count: monthBookings.filter((booking) => booking.status === status).length,
          })).filter((entry) => entry.count > 0),
          recentActivity: audit
            .filter((entry) => auditCategory(entry.action) !== 'auth')
            .slice(0, 7),
          billing: {
            mrrMillimes: agencies
              .filter((agency) => agency.status === 'ACTIVE')
              .reduce(
                (sum, agency) =>
                  sum + SUBSCRIPTION_PLAN_DEFINITIONS[agency.plan].monthlyPriceMillimes,
                0,
              ),
            outstandingMillimes: invoices
              .filter(unpaid)
              .reduce((sum, invoice) => sum + invoice.totalMillimes, 0),
            overdueInvoices: invoices.filter((invoice) => invoice.status === 'OVERDUE').length,
          },
        };
      }),

    getNavCounts: () =>
      respond(() => {
        const { agencies, reviews, invoices } = db();
        return {
          pendingAgencies: agencies.filter((agency) => agency.status === 'PENDING_REVIEW').length,
          flaggedReviews: reviews.filter((review) => review.status === 'FLAGGED').length,
          overdueInvoices: invoices.filter((invoice) => invoice.status === 'OVERDUE').length,
        };
      }),

    listAgencies: (query) =>
      respond(() => {
        const searched = db().agencies.filter((agency) =>
          matches(
            query.search,
            agency.name,
            agency.city,
            fullName(agency.owner),
            agency.owner.phone,
            agency.taxId,
          ),
        );
        const test = (agency: Agency, filter: AgencyFilter) =>
          filter === 'all' || agency.status === AGENCY_FILTER_STATUSES[filter];
        const filtered = searched
          .filter((agency) => test(agency, query.filter))
          .sort((a, b) =>
            a.status === 'PENDING_REVIEW' && b.status === 'PENDING_REVIEW'
              ? a.createdAt.localeCompare(b.createdAt)
              : b.gmvMonthMillimes - a.gmvMonthMillimes || a.name.localeCompare(b.name),
          );
        return {
          ...paginate(filtered, query.page),
          counts: countBy(
            searched,
            ['all', 'pending', 'active', 'suspended', 'rejected'] as const,
            test,
          ),
        };
      }),

    getAgency: (id) =>
      respond(() => {
        const { agencies, bookings, invoices, audit } = db();
        const agency = find(agencies, id, 'Agency');
        return {
          ...agency,
          recentBookings: bookings.filter((booking) => booking.agency.id === id).slice(0, 5),
          invoices: invoices.filter((invoice) => invoice.agency.id === id).slice(0, 4),
          activity: audit
            .filter((entry) => entry.target === agency.name && entry.action !== 'auth.signup')
            .slice(0, 8),
        };
      }),

    decideAgency: (id, input) =>
      respond(() => {
        const actor = authorize('agencies.decide');
        const { decision, reason } = validate(agencyDecisionInputSchema, input);
        const agency = find(db().agencies, id, 'Agency');
        if (!getAgencyDecisions(agency.status).includes(decision)) {
          throw new ApiError(409, 'CONFLICT', 'Invalid agency decision');
        }
        agency.status = applyAgencyDecision(agency.status, decision);
        agency.decidedAt = new Date().toISOString();
        agency.statusReason = reason !== undefined && reason.length > 0 ? reason : null;
        log(DECISION_ACTIONS[decision], actor, agency.name, agency.statusReason);
        return agency;
      }),

    listUsers: (query) =>
      respond(() => {
        const searched = db().users.filter((user) =>
          matches(query.search, fullName(user), user.phone, user.email, user.agency?.name ?? null),
        );
        const test = (user: PlatformUser, filter: UserFilter) => {
          switch (filter) {
            case 'all':
              return true;
            case 'customers':
              return user.role === 'CUSTOMER';
            case 'agency':
              return user.role === 'AGENCY_OWNER' || user.role === 'AGENCY_STAFF';
            case 'admins':
              return user.role === 'ADMIN';
            case 'suspended':
              return user.status === 'SUSPENDED';
          }
        };
        const filtered = searched
          .filter((user) => test(user, query.filter))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
          ...paginate(filtered, query.page),
          counts: countBy(
            searched,
            ['all', 'customers', 'agency', 'admins', 'suspended'] as const,
            test,
          ),
        };
      }),

    getUser: (id) =>
      respond(() => {
        const { users, audit } = db();
        const user = find(users, id, 'User');
        const name = fullName(user);
        return {
          ...user,
          activity: audit
            .filter((entry) => entry.actor?.id === id || entry.target === name)
            .slice(0, 10),
        };
      }),

    setUserStatus: (id, input) =>
      respond(() => {
        const actor = authorize('users.manage');
        const { decision, reason } = validate(userStatusInputSchema, input);
        const user = find(db().users, id, 'User');
        if (user.role === 'ADMIN' || user.id === actor.id) {
          throw new ApiError(403, 'FORBIDDEN', 'Admin accounts are managed separately');
        }
        if ((decision === 'SUSPEND') === (user.status === 'SUSPENDED')) {
          throw new ApiError(409, 'CONFLICT', 'Invalid user status change');
        }
        user.status = decision === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
        user.statusReason = decision === 'SUSPEND' ? (reason ?? null) : null;
        log(
          decision === 'SUSPEND' ? 'user.suspended' : 'user.reactivated',
          actor,
          fullName(user),
          user.statusReason,
        );
        return user;
      }),

    listBookings: (query) =>
      respond(() => {
        const now = Date.now();
        const searched = db().bookings.filter((booking) =>
          matches(
            query.search,
            booking.reference,
            fullName(booking.customer),
            booking.customer.phone,
            booking.agency.name,
            booking.vehicle.plateNumber,
          ),
        );
        const test = (booking: (typeof searched)[number], filter: BookingFilter) =>
          filter === 'all' || BOOKING_FILTER_STATUSES[filter].includes(booking.status);
        return {
          ...paginate(
            searched.filter((booking) => test(booking, query.filter)),
            query.page,
          ),
          counts: countBy(
            searched,
            ['all', 'pending', 'active', 'completed', 'cancelled'] as const,
            test,
          ),
          stalePending: searched.filter(
            (booking) => booking.status === 'PENDING' && isStale(booking.createdAt, now),
          ).length,
        };
      }),

    listInvoices: (query) =>
      respond(() => {
        const { invoices, agencies } = db();
        const searched = invoices.filter((invoice) =>
          matches(query.search, invoice.number, invoice.agency.name),
        );
        const test = (invoice: Invoice, filter: InvoiceFilter) =>
          filter === 'all' || invoice.status === filter.toUpperCase();
        const month = toMonthKey(new Date());
        const active = agencies.filter((agency) => agency.status === 'ACTIVE');
        return {
          ...paginate(
            searched.filter((invoice) => test(invoice, query.filter)),
            query.page,
          ),
          counts: countBy(searched, ['all', 'issued', 'overdue', 'paid'] as const, test),
          overview: {
            mrrMillimes: active.reduce(
              (sum, agency) =>
                sum + SUBSCRIPTION_PLAN_DEFINITIONS[agency.plan].monthlyPriceMillimes,
              0,
            ),
            collectedMonthMillimes: invoices
              .filter((invoice) => invoice.paidAt !== null && toMonthKey(invoice.paidAt) === month)
              .reduce((sum, invoice) => sum + invoice.totalMillimes, 0),
            outstandingMillimes: invoices
              .filter(unpaid)
              .reduce((sum, invoice) => sum + invoice.totalMillimes, 0),
            overdueMillimes: invoices
              .filter((invoice) => invoice.status === 'OVERDUE')
              .reduce((sum, invoice) => sum + invoice.totalMillimes, 0),
            plans: SUBSCRIPTION_PLANS.map((plan) => ({
              plan,
              agencies: active.filter((agency) => agency.plan === plan).length,
            })),
          },
        };
      }),

    getInvoice: (id) => respond(() => find(db().invoices, id, 'Invoice')),

    markInvoicePaid: (id, method: PaymentMethod) =>
      respond(() => {
        const actor = authorize('billing.manage');
        if (!PAYMENT_METHODS.includes(method)) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid payment method');
        }
        const invoice = find(db().invoices, id, 'Invoice');
        if (!unpaid(invoice)) {
          throw new ApiError(409, 'CONFLICT', 'Invoice already paid');
        }
        invoice.status = 'PAID';
        invoice.paidAt = new Date().toISOString();
        invoice.paymentMethod = method;
        log('invoice.paid', actor, invoice.number, null);
        return invoice;
      }),

    sendInvoiceReminder: (id) =>
      respond(() => {
        const actor = authorize('billing.manage');
        const invoice = find(db().invoices, id, 'Invoice');
        if (!unpaid(invoice)) {
          throw new ApiError(409, 'CONFLICT', 'Invoice already paid');
        }
        invoice.remindedAt = new Date().toISOString();
        log('invoice.reminder_sent', actor, invoice.number, null);
        return invoice;
      }),

    listReviews: (query) =>
      respond(() => {
        const { reviews } = db();
        const test = (review: ModeratedReview, filter: ReviewFilter) =>
          filter === 'all' || review.status === filter.toUpperCase();
        return {
          ...paginate(
            reviews.filter((review) => test(review, query.filter)),
            query.page,
          ),
          counts: countBy(reviews, ['flagged', 'published', 'hidden', 'all'] as const, test),
        };
      }),

    moderateReview: (id, input) =>
      respond(() => {
        const actor = authorize('reviews.moderate');
        const { decision, reason } = validate(reviewModerationInputSchema, input);
        const review = find(db().reviews, id, 'Review');
        if (review.status === (decision === 'HIDE' ? 'HIDDEN' : 'PUBLISHED')) {
          throw new ApiError(409, 'CONFLICT', 'Review already moderated');
        }
        review.status = decision === 'HIDE' ? 'HIDDEN' : 'PUBLISHED';
        review.moderatedAt = new Date().toISOString();
        review.moderationReason = decision === 'HIDE' ? (reason ?? null) : null;
        if (decision === 'PUBLISH') {
          review.reports = [];
        }
        log(
          decision === 'HIDE' ? 'review.hidden' : 'review.published',
          actor,
          review.agency.name,
          review.moderationReason,
        );
        return review;
      }),

    listAudit: (query) =>
      respond(() =>
        paginate(
          db().audit.filter(
            (entry) =>
              (query.category === 'all' || auditCategory(entry.action) === query.category) &&
              matches(
                query.search,
                entry.target,
                entry.detail,
                entry.ip,
                entry.actor === null ? null : fullName(entry.actor),
              ),
          ),
          query.page,
          AUDIT_PAGE_SIZE,
        ),
      ),

    getSettings: () => respond(() => db().settings),

    updateSettings: (input) =>
      respond(() => {
        const actor = authorize('settings.manage');
        const next = validate(platformSettingsSchema, input);
        const before = describeSettings(db().settings);
        const after = describeSettings(next);
        const changes = (Object.keys(after) as (keyof PlatformSettings)[])
          .filter((key) => before[key] !== after[key])
          .map((key) => `${before[key]} → ${after[key]}`);
        db().settings = next;
        if (changes.length > 0) {
          log('settings.updated', actor, null, changes.join(' · '));
        }
        return next;
      }),
  };
}

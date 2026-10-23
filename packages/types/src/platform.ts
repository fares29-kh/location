import { z } from 'zod';

import { emailSchema } from './auth';
import { addMonths, tunisDateTime } from './dates';
import { tunisianPhoneSchema } from './phone';

/** 1 % = 100 points de base. Les taux (TVA, commission) sont stockés en points de base entiers. */
export const BPS_PER_PERCENT = 100;
export const BPS_PER_UNIT = 10_000;

/** Applique un taux en points de base à un montant en millimes, arrondi au millime. */
export function applyRateBps(millimes: number, rateBps: number): number {
  return Math.round((millimes * rateBps) / BPS_PER_UNIT);
}

const PERCENT_INPUT_PATTERN = /^\d{1,3}(?:\.\d{1,2})?$/;

/**
 * Lit un pourcentage saisi (« 19 », « 7,5 ») et le renvoie en points de base.
 * Renvoie `null` si la saisie n'est pas un pourcentage entre 0 et 100 à 2 décimales au plus.
 */
export function parsePercentToBps(input: string): number | null {
  const normalized = input.replace(/[\s\u00A0\u202F%]/g, '').replace(',', '.');
  if (!PERCENT_INPUT_PATTERN.test(normalized)) {
    return null;
  }
  const bps = Math.round(Number(normalized) * BPS_PER_PERCENT);
  return bps <= BPS_PER_UNIT ? bps : null;
}

/** Valeur d'un champ de saisie en pourcentage à partir de points de base (« 7.5 » pour 750). */
export function bpsToPercentInput(bps: number): string {
  return String(bps / BPS_PER_PERCENT);
}

// --- Agences partenaires ---------------------------------------------------------

export const AGENCY_STATUSES = ['PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
export const agencyStatusSchema = z.enum(AGENCY_STATUSES);
export type AgencyStatus = z.infer<typeof agencyStatusSchema>;

/** Décisions de l'administration sur le compte d'une agence. */
export const AGENCY_DECISIONS = ['APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE'] as const;
export const agencyDecisionSchema = z.enum(AGENCY_DECISIONS);
export type AgencyDecision = z.infer<typeof agencyDecisionSchema>;

const AGENCY_DECISION_TRANSITIONS: Record<AgencyDecision, readonly AgencyStatus[]> = {
  APPROVE: ['PENDING_REVIEW'],
  REJECT: ['PENDING_REVIEW'],
  SUSPEND: ['ACTIVE'],
  REACTIVATE: ['SUSPENDED', 'REJECTED'],
};

const AGENCY_DECISION_RESULTS: Record<AgencyDecision, AgencyStatus> = {
  APPROVE: 'ACTIVE',
  REJECT: 'REJECTED',
  SUSPEND: 'SUSPENDED',
  REACTIVATE: 'ACTIVE',
};

/** Décisions dont le motif est communiqué à l'agence et conservé dans le journal d'audit. */
export const AGENCY_DECISIONS_WITH_REASON: readonly AgencyDecision[] = ['REJECT', 'SUSPEND'];

export function getAgencyDecisions(status: AgencyStatus): AgencyDecision[] {
  return AGENCY_DECISIONS.filter((decision) =>
    AGENCY_DECISION_TRANSITIONS[decision].includes(status),
  );
}

export function applyAgencyDecision(status: AgencyStatus, decision: AgencyDecision): AgencyStatus {
  if (!AGENCY_DECISION_TRANSITIONS[decision].includes(status)) {
    throw new Error(`Décision ${decision} impossible depuis le statut ${status}`);
  }
  return AGENCY_DECISION_RESULTS[decision];
}

const REASON_MAX_LENGTH = 300;

function withRequiredReason<T extends z.ZodType<{ reason?: string | undefined }>>(
  schema: T,
  needsReason: (value: z.output<T>) => boolean,
) {
  return schema.refine(
    (value) => !needsReason(value) || (value.reason !== undefined && value.reason.length > 0),
    { message: 'REQUIRED', path: ['reason'] },
  );
}

const reasonSchema = z.string().trim().max(REASON_MAX_LENGTH, { message: 'TOO_LONG' }).optional();

export const agencyDecisionInputSchema = withRequiredReason(
  z.object({ decision: agencyDecisionSchema, reason: reasonSchema }),
  (value) => AGENCY_DECISIONS_WITH_REASON.includes(value.decision),
);
export type AgencyDecisionInput = z.infer<typeof agencyDecisionInputSchema>;

/** Pièces exigées avant la mise en ligne d'une agence. */
export const AGENCY_DOCUMENT_KINDS = [
  'TRADE_REGISTER',
  'TAX_ID',
  'INSURANCE',
  'MANAGER_ID',
] as const;
export type AgencyDocumentKind = (typeof AGENCY_DOCUMENT_KINDS)[number];

// --- Abonnements et facturation -----------------------------------------------------

export const SUBSCRIPTION_PLANS = ['STARTER', 'PRO', 'BUSINESS'] as const;
export const subscriptionPlanSchema = z.enum(SUBSCRIPTION_PLANS);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export interface SubscriptionPlanDefinition {
  /** Abonnement mensuel hors taxes, en millimes. */
  monthlyPriceMillimes: number;
  /** Nombre maximal de véhicules publiés (`null` = illimité). */
  vehicleLimit: number | null;
}

export const SUBSCRIPTION_PLAN_DEFINITIONS: Record<SubscriptionPlan, SubscriptionPlanDefinition> = {
  STARTER: { monthlyPriceMillimes: 49_000, vehicleLimit: 5 },
  PRO: { monthlyPriceMillimes: 99_000, vehicleLimit: 20 },
  BUSINESS: { monthlyPriceMillimes: 199_000, vehicleLimit: null },
};

/** Durée de l'essai gratuit accordé à la création du compte agence. */
export const TRIAL_DAYS = 14;

const TRIAL_DAY_MS = 86_400_000;

/** Fin de l'essai, 14 jours après l'ouverture du compte. */
export function trialEnd(openedAt: Date): Date {
  return new Date(openedAt.getTime() + TRIAL_DAYS * TRIAL_DAY_MS);
}

/** Jours entiers restants. `null` quand l'essai est terminé. */
export function trialDaysLeft(trialEndsAt: Date, now: Date): number | null {
  const remaining = trialEndsAt.getTime() - now.getTime();
  if (remaining <= 0) {
    return null;
  }
  return Math.ceil(remaining / TRIAL_DAY_MS);
}

/**
 * L'abonnement n'est plus en règle : l'essai est fini, et aucune facture n'est payée
 * ou une facture échue reste impayée. Les comptes sans essai (ouverts avant cette règle)
 * ne sont pas concernés.
 */
export function subscriptionLapsed({
  now,
  trialEndsAt,
  invoices,
}: {
  now: Date;
  trialEndsAt: Date | null;
  invoices: readonly { paidAt: Date | null; dueAt: Date }[];
}): boolean {
  if (trialEndsAt === null || now.getTime() < trialEndsAt.getTime()) {
    return false;
  }
  const paid = invoices.some((invoice) => invoice.paidAt !== null);
  const overdue = invoices.some(
    (invoice) => invoice.paidAt === null && invoice.dueAt.getTime() < now.getTime(),
  );
  return overdue || !paid;
}

export const INVOICE_STATUSES = ['ISSUED', 'PAID', 'OVERDUE'] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export interface InvoiceTotals {
  subtotalMillimes: number;
  vatMillimes: number;
  fiscalStampMillimes: number;
  totalMillimes: number;
}

/** Totaux d'une facture tunisienne : HT, TVA arrondie au millime, timbre fiscal, TTC. */
export function computeInvoiceTotals({
  subtotalMillimes,
  vatRateBps,
  fiscalStampMillimes,
}: {
  subtotalMillimes: number;
  vatRateBps: number;
  fiscalStampMillimes: number;
}): InvoiceTotals {
  const vatMillimes = applyRateBps(subtotalMillimes, vatRateBps);
  return {
    subtotalMillimes,
    vatMillimes,
    fiscalStampMillimes,
    totalMillimes: subtotalMillimes + vatMillimes + fiscalStampMillimes,
  };
}

/** Jour du mois d'émission avant lequel la facture du mois précédent doit être réglée. */
export const INVOICE_DUE_DAY = 15;

export interface BillingPeriod {
  /** Mois facturé « AAAA-MM ». */
  period: string;
  /** Bornes de la période (heure de Tunis) : [start, end[. */
  start: Date;
  end: Date;
  /** Émission le 1er du mois suivant, échéance le 15 à 23 h 59. */
  issuedAt: Date;
  dueAt: Date;
}

export function billingPeriod(period: string): BillingPeriod {
  const issueMonth = addMonths(period, 1);
  return {
    period,
    start: tunisDateTime(`${period}-01`, 0),
    end: tunisDateTime(`${issueMonth}-01`, 0),
    issuedAt: tunisDateTime(`${issueMonth}-01`, 8),
    dueAt: tunisDateTime(`${issueMonth}-${String(INVOICE_DUE_DAY)}`, 23, 59),
  };
}

export interface InvoiceAmounts extends InvoiceTotals {
  subscriptionMillimes: number;
  commissionMillimes: number;
  vatRateBps: number;
}

/** Montants de la facture mensuelle d'une agence : abonnement de l'offre + commission sur le CA. */
export function computeInvoiceAmounts({
  plan,
  commissionBps,
  revenueMillimes,
  vatRateBps,
  fiscalStampMillimes,
}: {
  plan: SubscriptionPlan;
  commissionBps: number;
  /** Chiffre d'affaires des locations terminées sur la période. */
  revenueMillimes: number;
  vatRateBps: number;
  fiscalStampMillimes: number;
}): InvoiceAmounts {
  const subscriptionMillimes = SUBSCRIPTION_PLAN_DEFINITIONS[plan].monthlyPriceMillimes;
  const commissionMillimes = applyRateBps(revenueMillimes, commissionBps);
  return {
    subscriptionMillimes,
    commissionMillimes,
    vatRateBps,
    ...computeInvoiceTotals({
      subtotalMillimes: subscriptionMillimes + commissionMillimes,
      vatRateBps,
      fiscalStampMillimes,
    }),
  };
}

// --- Paramètres de la plateforme ------------------------------------------------------

export const VAT_RATE_MAX_BPS = 3000;
export const COMMISSION_MAX_BPS = 3000;
export const FISCAL_STAMP_MAX_MILLIMES = 10_000;
export const BOOKING_EXPIRY_HOURS_MIN = 1;
export const BOOKING_EXPIRY_HOURS_MAX = 72;

/** Valeurs de la table `PlatformSetting`, éditables par un super administrateur. */
export const platformSettingsSchema = z.object({
  vatRateBps: z
    .number()
    .int()
    .min(0, { message: 'OUT_OF_RANGE' })
    .max(VAT_RATE_MAX_BPS, { message: 'OUT_OF_RANGE' }),
  fiscalStampMillimes: z
    .number()
    .int()
    .min(0, { message: 'OUT_OF_RANGE' })
    .max(FISCAL_STAMP_MAX_MILLIMES, { message: 'OUT_OF_RANGE' }),
  defaultCommissionBps: z
    .number()
    .int()
    .min(0, { message: 'OUT_OF_RANGE' })
    .max(COMMISSION_MAX_BPS, { message: 'OUT_OF_RANGE' }),
  /** Délai au-delà duquel une demande de réservation sans réponse expire. */
  bookingExpiryHours: z
    .number()
    .int()
    .min(BOOKING_EXPIRY_HOURS_MIN, { message: 'OUT_OF_RANGE' })
    .max(BOOKING_EXPIRY_HOURS_MAX, { message: 'OUT_OF_RANGE' }),
  supportPhone: tunisianPhoneSchema,
  supportEmail: emailSchema,
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  vatRateBps: 1900,
  fiscalStampMillimes: 1000,
  defaultCommissionBps: 0,
  bookingExpiryHours: 24,
  supportPhone: '71000000',
  supportEmail: 'support@drivetn.tn',
};

// --- Modération des avis --------------------------------------------------------------

export const REVIEW_MODERATION_STATUSES = ['PUBLISHED', 'FLAGGED', 'HIDDEN'] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const REVIEW_REPORT_REASONS = ['OFFENSIVE', 'SPAM', 'PERSONAL_DATA', 'OFF_TOPIC'] as const;
export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

export const REVIEW_MODERATION_DECISIONS = ['PUBLISH', 'HIDE'] as const;
export type ReviewModerationDecision = (typeof REVIEW_MODERATION_DECISIONS)[number];

export const reviewModerationInputSchema = withRequiredReason(
  z.object({ decision: z.enum(REVIEW_MODERATION_DECISIONS), reason: reasonSchema }),
  (value) => value.decision === 'HIDE',
);
export type ReviewModerationInput = z.infer<typeof reviewModerationInputSchema>;

// --- Comptes utilisateurs -------------------------------------------------------------

export const USER_STATUS_DECISIONS = ['SUSPEND', 'REACTIVATE'] as const;
export type UserStatusDecision = (typeof USER_STATUS_DECISIONS)[number];

export const userStatusInputSchema = withRequiredReason(
  z.object({ decision: z.enum(USER_STATUS_DECISIONS), reason: reasonSchema }),
  (value) => value.decision === 'SUSPEND',
);
export type UserStatusInput = z.infer<typeof userStatusInputSchema>;

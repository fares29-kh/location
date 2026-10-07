import { z } from 'zod';

/** Cycle de vie d'une réservation (aucun paiement en ligne). */
export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'NO_SHOW',
  'EXPIRED',
] as const;

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export type BookingStatus = z.infer<typeof bookingStatusSchema>;

/** Statut déclaratif : l'agence enregistre ce qu'elle a encaissé hors plateforme. */
export const PAYMENT_STATUSES = ['UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED_OFFLINE'] as const;

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** Modes de paiement qu'une agence peut accepter. Aucun n'est traité par la plateforme. */
export const PAYMENT_METHODS = [
  'CASH',
  'CARD_TPE',
  'CHECK',
  'BANK_TRANSFER',
  'MOBILE_PAYMENT',
  'MONEY_ORDER',
] as const;

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// --- Workflow de réservation côté agence ---------------------------------------

export const BOOKING_ACTIONS = [
  'CONFIRM',
  'REJECT',
  'PICK_UP',
  'RETURN',
  'COMPLETE',
  'NO_SHOW',
  'CANCEL',
] as const;

export const bookingActionSchema = z.enum(BOOKING_ACTIONS);

export type BookingAction = z.infer<typeof bookingActionSchema>;

const BOOKING_TRANSITIONS: Record<
  BookingAction,
  { from: readonly BookingStatus[]; to: BookingStatus }
> = {
  CONFIRM: { from: ['PENDING'], to: 'CONFIRMED' },
  REJECT: { from: ['PENDING'], to: 'REJECTED' },
  PICK_UP: { from: ['CONFIRMED'], to: 'PICKED_UP' },
  RETURN: { from: ['PICKED_UP'], to: 'RETURNED' },
  COMPLETE: { from: ['RETURNED'], to: 'COMPLETED' },
  NO_SHOW: { from: ['CONFIRMED'], to: 'NO_SHOW' },
  CANCEL: { from: ['CONFIRMED'], to: 'CANCELLED' },
};

/** Actions qui exigent un motif communiqué au client. */
export const BOOKING_ACTIONS_WITH_REASON: readonly BookingAction[] = ['REJECT', 'CANCEL'];

export function canApplyBookingAction(status: BookingStatus, action: BookingAction): boolean {
  return BOOKING_TRANSITIONS[action].from.includes(status);
}

/** Actions possibles depuis un statut, dans l'ordre d'affichage (action principale en premier). */
export function getBookingActions(status: BookingStatus): BookingAction[] {
  return BOOKING_ACTIONS.filter((action) => canApplyBookingAction(status, action));
}

export function applyBookingAction(status: BookingStatus, action: BookingAction): BookingStatus {
  if (!canApplyBookingAction(status, action)) {
    throw new Error(`Transition interdite : ${action} depuis ${status}`);
  }
  return BOOKING_TRANSITIONS[action].to;
}

/** Statuts qui immobilisent le véhicule (demande en cours, réservé ou sorti). */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PICKED_UP',
];

export function isBookingBlocking(status: BookingStatus): boolean {
  return BLOCKING_BOOKING_STATUSES.includes(status);
}

/** Statuts définitifs : plus aucune action possible. */
export function isBookingClosed(status: BookingStatus): boolean {
  return getBookingActions(status).length === 0;
}

export const bookingTransitionSchema = z
  .object({
    action: bookingActionSchema,
    reason: z.string().trim().max(300, { message: 'TOO_LONG' }).optional(),
  })
  .refine(
    (value) =>
      !BOOKING_ACTIONS_WITH_REASON.includes(value.action) ||
      (value.reason !== undefined && value.reason.length > 0),
    { message: 'REQUIRED', path: ['reason'] },
  );

export type BookingTransitionInput = z.infer<typeof bookingTransitionSchema>;

// --- Encaissements déclarés -----------------------------------------------------

/**
 * Nature d'un mouvement déclaré par l'agence : paiement de la location, remboursement,
 * caution encaissée au départ ou restituée au retour.
 */
export const PAYMENT_KINDS = ['RENTAL', 'REFUND', 'DEPOSIT_HELD', 'DEPOSIT_RETURNED'] as const;

export const paymentKindSchema = z.enum(PAYMENT_KINDS);

export type PaymentKind = z.infer<typeof paymentKindSchema>;

export const recordPaymentSchema = z.object({
  kind: paymentKindSchema,
  method: paymentMethodSchema,
  amountMillimes: z.number().int().positive({ message: 'INVALID_AMOUNT' }),
  note: z.string().trim().max(200, { message: 'TOO_LONG' }).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export interface PaymentEntry {
  kind: PaymentKind;
  amountMillimes: number;
}

export interface PaymentSummary {
  /** Location encaissée, remboursements déduits. */
  paidMillimes: number;
  /** Reste à encaisser sur la location (jamais négatif). */
  balanceMillimes: number;
  /** Caution actuellement détenue par l'agence. */
  depositHeldMillimes: number;
  status: PaymentStatus;
}

function sumOf(entries: readonly PaymentEntry[], kind: PaymentKind): number {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((total, entry) => total + entry.amountMillimes, 0);
}

/** Calcule le statut de paiement d'une réservation à partir des mouvements déclarés. */
export function summarizePayments(
  totalMillimes: number,
  entries: readonly PaymentEntry[],
): PaymentSummary {
  const refunded = sumOf(entries, 'REFUND');
  const paidMillimes = sumOf(entries, 'RENTAL') - refunded;
  const depositHeldMillimes = sumOf(entries, 'DEPOSIT_HELD') - sumOf(entries, 'DEPOSIT_RETURNED');

  let status: PaymentStatus = 'UNPAID';
  if (refunded > 0 && paidMillimes <= 0) {
    status = 'REFUNDED_OFFLINE';
  } else if (paidMillimes >= totalMillimes && totalMillimes > 0) {
    status = 'PAID';
  } else if (paidMillimes > 0) {
    status = 'DEPOSIT_PAID';
  }

  return {
    paidMillimes,
    balanceMillimes: Math.max(0, totalMillimes - paidMillimes),
    depositHeldMillimes,
    status,
  };
}

/** Nombre de jours facturés : toute journée entamée est due (minimum 1). */
export function rentalDays(pickupAt: Date, returnAt: Date): number {
  const hours = (returnAt.getTime() - pickupAt.getTime()) / 3_600_000;
  return Math.max(1, Math.ceil(hours / 24));
}

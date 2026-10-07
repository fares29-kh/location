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

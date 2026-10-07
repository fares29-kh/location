import { describe, expect, it } from 'vitest';

import {
  applyBookingAction,
  bookingTransitionSchema,
  getBookingActions,
  isBookingBlocking,
  isBookingClosed,
  rentalDays,
  summarizePayments,
} from './booking';

describe('workflow de réservation', () => {
  it('propose les actions possibles selon le statut', () => {
    expect(getBookingActions('PENDING')).toEqual(['CONFIRM', 'REJECT']);
    expect(getBookingActions('CONFIRMED')).toEqual(['PICK_UP', 'NO_SHOW', 'CANCEL']);
    expect(getBookingActions('PICKED_UP')).toEqual(['RETURN']);
    expect(getBookingActions('RETURNED')).toEqual(['COMPLETE']);
    expect(getBookingActions('COMPLETED')).toEqual([]);
  });

  it('applique les transitions autorisées et refuse les autres', () => {
    expect(applyBookingAction('PENDING', 'CONFIRM')).toBe('CONFIRMED');
    expect(applyBookingAction('CONFIRMED', 'PICK_UP')).toBe('PICKED_UP');
    expect(() => applyBookingAction('COMPLETED', 'CANCEL')).toThrow();
    expect(() => applyBookingAction('PENDING', 'RETURN')).toThrow();
  });

  it('distingue les statuts bloquants et définitifs', () => {
    expect(isBookingBlocking('CONFIRMED')).toBe(true);
    expect(isBookingBlocking('CANCELLED')).toBe(false);
    expect(isBookingClosed('REJECTED')).toBe(true);
    expect(isBookingClosed('PENDING')).toBe(false);
  });

  it('exige un motif pour un refus ou une annulation', () => {
    expect(bookingTransitionSchema.safeParse({ action: 'REJECT' }).success).toBe(false);
    expect(bookingTransitionSchema.safeParse({ action: 'REJECT', reason: '  ' }).success).toBe(
      false,
    );
    expect(
      bookingTransitionSchema.safeParse({ action: 'REJECT', reason: 'Véhicule indisponible' })
        .success,
    ).toBe(true);
    expect(bookingTransitionSchema.safeParse({ action: 'CONFIRM' }).success).toBe(true);
  });
});

describe('summarizePayments', () => {
  it('ne déclare rien tant qu’aucun paiement n’est saisi', () => {
    expect(summarizePayments(300_000, [])).toEqual({
      paidMillimes: 0,
      balanceMillimes: 300_000,
      depositHeldMillimes: 0,
      status: 'UNPAID',
    });
  });

  it('distingue avance, solde complet et caution', () => {
    const partial = summarizePayments(300_000, [
      { kind: 'RENTAL', amountMillimes: 100_000 },
      { kind: 'DEPOSIT_HELD', amountMillimes: 500_000 },
    ]);
    expect(partial.status).toBe('DEPOSIT_PAID');
    expect(partial.balanceMillimes).toBe(200_000);
    expect(partial.depositHeldMillimes).toBe(500_000);

    const paid = summarizePayments(300_000, [
      { kind: 'RENTAL', amountMillimes: 100_000 },
      { kind: 'RENTAL', amountMillimes: 200_000 },
      { kind: 'DEPOSIT_HELD', amountMillimes: 500_000 },
      { kind: 'DEPOSIT_RETURNED', amountMillimes: 500_000 },
    ]);
    expect(paid.status).toBe('PAID');
    expect(paid.balanceMillimes).toBe(0);
    expect(paid.depositHeldMillimes).toBe(0);
  });

  it('marque une réservation remboursée intégralement', () => {
    const refunded = summarizePayments(300_000, [
      { kind: 'RENTAL', amountMillimes: 100_000 },
      { kind: 'REFUND', amountMillimes: 100_000 },
    ]);
    expect(refunded.status).toBe('REFUNDED_OFFLINE');
    expect(refunded.paidMillimes).toBe(0);
  });
});

describe('rentalDays', () => {
  it('facture toute journée entamée, avec un minimum d’un jour', () => {
    const start = new Date('2026-07-01T10:00:00Z');
    expect(rentalDays(start, new Date('2026-07-04T10:00:00Z'))).toBe(3);
    expect(rentalDays(start, new Date('2026-07-04T12:00:00Z'))).toBe(4);
    expect(rentalDays(start, new Date('2026-07-01T15:00:00Z'))).toBe(1);
  });
});

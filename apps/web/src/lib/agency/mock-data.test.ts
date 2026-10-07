import { isBookingBlocking, isValidTunisianPhone, summarizePayments } from '@drivetn/types';
import { describe, expect, it } from 'vitest';

import { toDayKey } from './dates';
import { createAgencyDataset } from './mock-data';

const NOW = new Date('2026-10-07T09:00:00Z');

describe('jeu de données de démonstration', () => {
  const dataset = createAgencyDataset(NOW);

  it('est déterministe', () => {
    expect(createAgencyDataset(NOW)).toEqual(dataset);
  });

  it('ne réserve jamais deux fois le même véhicule sur une même période', () => {
    for (const vehicle of dataset.vehicles) {
      const blocking = dataset.bookings
        .filter((booking) => booking.vehicleId === vehicle.id && isBookingBlocking(booking.status))
        .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
      for (let index = 1; index < blocking.length; index += 1) {
        const previous = blocking[index - 1];
        const current = blocking[index];
        expect(previous !== undefined && current !== undefined).toBe(true);
        if (previous !== undefined && current !== undefined) {
          expect(previous.returnAt <= current.pickupAt).toBe(true);
        }
      }
    }
  });

  it('ne déclare jamais plus que le total ni de paiement futur', () => {
    for (const booking of dataset.bookings) {
      const payments = dataset.payments.filter((payment) => payment.bookingId === booking.id);
      expect(summarizePayments(booking.totalMillimes, payments).paidMillimes).toBeLessThanOrEqual(
        booking.totalMillimes,
      );
      for (const payment of payments) {
        expect(new Date(payment.recordedAt).getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
    }
  });

  it('alimente le tableau de bord : demandes, départs et retours du jour', () => {
    const today = toDayKey(NOW);
    expect(dataset.bookings.some((booking) => booking.status === 'PENDING')).toBe(true);
    expect(
      dataset.bookings.some(
        (booking) => booking.status === 'CONFIRMED' && toDayKey(booking.pickupAt) === today,
      ),
    ).toBe(true);
    expect(
      dataset.bookings.some(
        (booking) => booking.status === 'PICKED_UP' && toDayKey(booking.returnAt) === today,
      ),
    ).toBe(true);
  });

  it('utilise des numéros de téléphone tunisiens valides', () => {
    for (const customer of dataset.customers) {
      expect(isValidTunisianPhone(customer.phone)).toBe(true);
    }
  });
});

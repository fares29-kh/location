import { describe, expect, it } from 'vitest';

import type { PlanningBooking, PlanningData, Vehicle } from '@/lib/agency/types';

import { daySummary, freeCountByDay, occupiedDays, plannedRate } from './planning-model';

function vehicle(id: string, status: Vehicle['status'] = 'ACTIVE'): Vehicle {
  return { id, status } as Vehicle;
}

function booking(
  id: string,
  vehicleId: string,
  pickupAt: string,
  returnAt: string,
  status: PlanningBooking['status'] = 'CONFIRMED',
): PlanningBooking {
  return {
    id,
    reference: id,
    vehicleId,
    status,
    pickupAt,
    returnAt,
    totalMillimes: 0,
    customer: { id: 'c', firstName: 'A', lastName: 'B' },
  };
}

const DAYS = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];

/** Minuit à Tunis = 23 h UTC la veille. */
const data: PlanningData = {
  from: '2026-12-01',
  to: '2026-12-05',
  days: 4,
  vehicles: [vehicle('v1'), vehicle('v2'), vehicle('v3', 'MAINTENANCE')],
  bookings: [
    booking('b1', 'v1', '2026-12-01T09:00:00Z', '2026-12-02T09:00:00Z'),
    booking('b2', 'v2', '2026-12-03T08:00:00Z', '2026-12-03T18:00:00Z', 'CANCELLED'),
    booking('b3', 'v2', '2026-12-04T08:00:00Z', '2026-12-04T18:00:00Z', 'PICKED_UP'),
  ],
  maintenances: [{ id: 'm1', vehicleId: 'v2', from: '2026-12-02', to: '2026-12-02', note: '' }],
};

describe('planning', () => {
  it('compte les jours touchés par une réservation active ou un entretien', () => {
    expect([...occupiedDays('v1', data, DAYS)]).toEqual(['2026-12-01', '2026-12-02']);
    expect([...occupiedDays('v2', data, DAYS)]).toEqual(['2026-12-02', '2026-12-04']);
  });

  it('ne compte libres que les véhicules disponibles sans rien de prévu', () => {
    expect(Object.fromEntries(freeCountByDay(data, DAYS))).toEqual({
      '2026-12-01': 1,
      '2026-12-02': 0,
      '2026-12-03': 2,
      '2026-12-04': 1,
    });
  });

  it('résume la journée : départs, retours, entretiens', () => {
    expect(daySummary(data, '2026-12-01')).toEqual({
      total: 3,
      free: 1,
      departures: 1,
      returns: 0,
      inMaintenance: 1,
    });
    expect(daySummary(data, '2026-12-02')).toMatchObject({ free: 0, inMaintenance: 2 });
    expect(daySummary(data, '2026-12-04')).toMatchObject({ returns: 1 });
  });

  it('calcule l’occupation confirmée sur la période', () => {
    const start = Date.parse('2026-11-30T23:00:00Z');
    expect(plannedRate('v1', data.bookings, { start, end: start + 4 * 86_400_000 })).toBeCloseTo(
      0.25,
    );
    expect(plannedRate('v2', data.bookings, { start, end: start + 86_400_000 })).toBe(0);
  });
});

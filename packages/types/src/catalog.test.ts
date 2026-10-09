import { describe, expect, it } from 'vitest';

import { publicAgencySchema, spreadAround } from './catalog';

const SOUSSE = { latitude: 35.8256, longitude: 10.636 };

function distanceKm(a: { latitude: number; longitude: number }, b: typeof a): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe('spreadAround', () => {
  it('laisse la première agence au centre', () => {
    expect(spreadAround(SOUSSE, 0)).toEqual(SOUSSE);
  });

  it('écarte les agences suivantes sans les superposer ni trop les éloigner', () => {
    const points = Array.from({ length: 12 }, (_, index) => spreadAround(SOUSSE, index));
    for (const [index, point] of points.entries()) {
      expect(distanceKm(SOUSSE, point)).toBeLessThan(4);
      for (const other of points.slice(index + 1)) {
        expect(distanceKm(point, other)).toBeGreaterThan(0.5);
      }
    }
  });

  it('est déterministe', () => {
    expect(spreadAround(SOUSSE, 5)).toEqual(spreadAround(SOUSSE, 5));
  });
});

describe('publicAgencySchema', () => {
  it('accepte une agence sans logo, avis ni véhicule', () => {
    expect(
      publicAgencySchema.safeParse({
        id: 'agc_1',
        name: 'Sahel Cars',
        logoUrl: null,
        governorateCode: '51',
        address: 'Avenue Habib Bourguiba, Sousse',
        description: '',
        phone: '73123456',
        whatsappPhone: '98123456',
        rating: null,
        reviewsCount: 0,
        vehiclesCount: 0,
        fromDailyRateMillimes: null,
        categories: [],
        instantConfirmation: false,
        freeCancellationHours: 48,
        ...SOUSSE,
      }).success,
    ).toBe(true);
  });
});

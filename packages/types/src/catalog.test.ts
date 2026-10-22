import { describe, expect, it } from 'vitest';

import {
  canCustomerReview,
  canEditCustomerReview,
  createReviewSchema,
  isDayOccupied,
  mergeUnavailableRanges,
  publicAgencySchema,
  publicReviewAuthor,
  rangesOverlap,
  selectRentalDay,
  spreadAround,
} from './catalog';

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

describe('dates déjà réservées', () => {
  const taken = [{ pickup: '2026-10-25', return: '2026-10-28' }];

  it('bloque le créneau confirmé et laisse libre le matin du retour', () => {
    expect(rangesOverlap('2026-10-25', '2026-10-28', taken)).toBe(true);
    expect(rangesOverlap('2026-10-26', '2026-10-27', taken)).toBe(true);
    expect(rangesOverlap('2026-10-20', '2026-10-25', taken)).toBe(false);
    expect(rangesOverlap('2026-10-28', '2026-10-30', taken)).toBe(false);
    expect(isDayOccupied('2026-10-27', taken)).toBe(true);
    expect(isDayOccupied('2026-10-28', taken)).toBe(false);
  });

  it('fusionne les absences qui se suivent', () => {
    expect(
      mergeUnavailableRanges([
        { pickup: '2026-11-10', return: '2026-11-12' },
        { pickup: '2026-11-12', return: '2026-11-14' },
        { pickup: '2026-12-01', return: '2026-12-03' },
      ]),
    ).toEqual([
      { pickup: '2026-11-10', return: '2026-11-14' },
      { pickup: '2026-12-01', return: '2026-12-03' },
    ]);
  });

  it('refuse un retour qui traverse une réservation confirmée', () => {
    expect(
      selectRentalDay({ pickup: '2026-10-24', return: null }, '2026-10-29', taken, '2026-10-22'),
    ).toEqual({
      kind: 'rejected',
      reason: 'overlap',
    });
    expect(
      selectRentalDay({ pickup: null, return: null }, '2026-10-28', taken, '2026-10-22'),
    ).toEqual({
      kind: 'range',
      pickup: '2026-10-28',
      return: null,
    });
    expect(
      selectRentalDay({ pickup: null, return: null }, '2026-10-26', taken, '2026-10-22'),
    ).toEqual({
      kind: 'rejected',
      reason: 'unavailable',
    });
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

describe('avis client', () => {
  it('n’accepte une note qu’après le retour du véhicule', () => {
    expect(canCustomerReview('COMPLETED')).toBe(true);
    expect(canCustomerReview('RETURNED')).toBe(true);
    expect(canCustomerReview('PICKED_UP')).toBe(false);
    expect(canCustomerReview('CANCELLED')).toBe(false);
  });

  it('abrège le nom publié', () => {
    expect(publicReviewAuthor('Amine', 'Ben Ali')).toBe('Amine B.');
    expect(publicReviewAuthor('Amine', '  ')).toBe('Amine');
  });

  it('exige une note et un commentaire', () => {
    expect(createReviewSchema.safeParse({ rating: 5, comment: '  Court ' }).success).toBe(false);
    expect(
      createReviewSchema.parse({ rating: 4, comment: '  Voiture propre, accueil correct.  ' }),
    ).toEqual({ rating: 4, comment: 'Voiture propre, accueil correct.' });
  });

  it('bloque la modification dès qu’une réponse ou une modération existe', () => {
    const review = {
      id: 'rev',
      rating: 5,
      comment: 'Très bonne location, je recommande.',
      createdAt: '2026-10-22T10:00:00.000Z',
      reply: null,
      repliedAt: null,
      moderationStatus: 'PUBLISHED' as const,
    };
    expect(canEditCustomerReview(review)).toBe(true);
    expect(canEditCustomerReview({ ...review, reply: 'Merci' })).toBe(false);
    expect(canEditCustomerReview({ ...review, moderationStatus: 'FLAGGED' })).toBe(false);
  });
});

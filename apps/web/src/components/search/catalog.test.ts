import { describe, expect, it } from 'vitest';

import type { Offer } from '@drivetn/types';

import {
  API_CATEGORIES,
  bookableDates,
  countActiveFilters,
  DEFAULT_FILTERS,
  filterOffers,
  fromApiCategory,
  isVehicleCategory,
  rentalDays,
  SAMPLE_OFFERS,
  sortOffers,
  toSearchOffer,
  VEHICLE_CATEGORIES,
} from './catalog';

const OFFER: Offer = {
  vehicleId: 'v1',
  brand: 'Kia',
  model: 'Picanto',
  year: 2023,
  category: 'ECONOMY',
  transmission: 'MANUAL',
  fuel: 'PETROL',
  seats: 4,
  airConditioning: true,
  color: 'Blanc',
  dailyRateMillimes: 75_000,
  depositMillimes: 500_000,
  mileageLimitKm: null,
  agency: {
    id: 'a1',
    name: 'Agence Test',
    governorateCode: '11',
    address: 'Tunis',
    rating: null,
    reviewsCount: 0,
    instantConfirmation: false,
    freeCancellationHours: 48,
    minDriverAge: 21,
    acceptedPaymentMethods: ['CASH'],
  },
};

describe('catégories et offres de l’API', () => {
  it('associe chaque catégorie affichée à une catégorie de flotte distincte', () => {
    for (const category of VEHICLE_CATEGORIES) {
      expect(fromApiCategory(API_CATEGORIES[category])).toBe(category);
    }
  });

  it('convertit une offre pour l’affichage et les filtres', () => {
    const offer = toSearchOffer(OFFER);
    expect(offer).toMatchObject({
      id: 'v1',
      category: 'city',
      pricePerDayMillimes: 75_000,
      unlimitedMileage: true,
      rating: null,
      reviews: 0,
    });
    expect(sortOffers([offer, { ...offer, id: 'v2', rating: 4.2 }], 'rating')[0]?.id).toBe('v2');
  });
});

describe('bookableDates', () => {
  it('accepte un retour après un départ à partir d’aujourd’hui', () => {
    expect(bookableDates('2026-10-10', '2026-10-12', '2026-10-08')).toEqual({
      pickup: '2026-10-10',
      dropoff: '2026-10-12',
    });
  });

  it('refuse les dates passées, inversées, identiques ou absentes', () => {
    expect(bookableDates('2026-10-01', '2026-10-12', '2026-10-08')).toBeNull();
    expect(bookableDates('2026-10-12', '2026-10-10', '2026-10-08')).toBeNull();
    expect(bookableDates('2026-10-10', '2026-10-10', '2026-10-08')).toBeNull();
    expect(bookableDates(null, '2026-10-10', '2026-10-08')).toBeNull();
  });
});

describe('filterOffers', () => {
  it('renvoie toutes les offres sans filtre', () => {
    expect(filterOffers(SAMPLE_OFFERS, DEFAULT_FILTERS)).toHaveLength(SAMPLE_OFFERS.length);
  });

  it('combine catégorie, boîte de vitesses, plafond de prix et kilométrage', () => {
    const result = filterOffers(SAMPLE_OFFERS, {
      categories: ['suv', 'compact'],
      transmission: 'AUTOMATIC',
      priceCap: 150_000,
      unlimitedMileageOnly: true,
    });
    expect(result.map((offer) => offer.id)).toEqual(['polo']);
  });
});

describe('sortOffers', () => {
  it('trie par prix croissant et décroissant sans modifier la liste d’origine', () => {
    const ascending = sortOffers(SAMPLE_OFFERS, 'priceAsc');
    const prices = ascending.map((offer) => offer.pricePerDayMillimes);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(sortOffers(SAMPLE_OFFERS, 'priceDesc')[0]?.id).toBe('classC');
    expect(SAMPLE_OFFERS[0]?.id).toBe('picanto');
  });

  it('trie par note puis par nombre d’avis', () => {
    const [first] = sortOffers(SAMPLE_OFFERS, 'rating');
    expect(first?.id).toBe('classC');
  });
});

describe('rentalDays', () => {
  it('compte les jours entre deux dates, avec un minimum d’un jour', () => {
    expect(rentalDays('2026-07-01', '2026-07-04')).toBe(3);
    expect(rentalDays('2026-07-01', '2026-07-01')).toBe(1);
    expect(rentalDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('rejette les dates absentes, mal formées ou inversées', () => {
    expect(rentalDays(null, '2026-07-04')).toBeNull();
    expect(rentalDays('01/07/2026', '2026-07-04')).toBeNull();
    expect(rentalDays('2026-07-04', '2026-07-01')).toBeNull();
  });
});

describe('countActiveFilters / isVehicleCategory', () => {
  it('compte chaque critère actif', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, categories: ['city', 'suv'], priceCap: 100_000 }),
    ).toBe(3);
  });

  it('valide les catégories reçues dans l’URL', () => {
    expect(isVehicleCategory('suv')).toBe(true);
    expect(isVehicleCategory('truck')).toBe(false);
    expect(isVehicleCategory(null)).toBe(false);
  });
});

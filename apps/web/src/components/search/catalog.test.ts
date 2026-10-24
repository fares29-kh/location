import { describe, expect, it } from 'vitest';

import type { Offer, VehicleCategoryInfo } from '@drivetn/types';

import {
  bookableDates,
  brandGroups,
  categoryGradient,
  categoryLabel,
  countActiveFilters,
  DEFAULT_FILTERS,
  filterOffers,
  listActiveFilters,
  type OfferFilters,
  parseSearchFilters,
  removeFilter,
  rentalDays,
  SAMPLE_OFFERS,
  sortOffers,
  toggleBrand,
  toggleModel,
  toSearchOffer,
  writeSearchFilters,
} from './catalog';

const INSTANT = new Set(['polo', 'sportage']);
const OFFERS = SAMPLE_OFFERS.map((offer) => {
  const [brand = '', ...model] = offer.model.split(' ');
  return {
    ...offer,
    brand,
    model: model.join(' '),
    instantConfirmation: INSTANT.has(offer.id),
  };
});

const OFFER: Offer = {
  vehicleId: 'v1',
  brand: 'Kia',
  model: 'Picanto',
  year: 2023,
  category: 'city',
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
    logoUrl: null,
    governorateCode: '11',
    address: 'Tunis',
    rating: null,
    reviewsCount: 0,
    instantConfirmation: false,
    freeCancellationHours: 48,
    minDriverAge: 21,
    acceptedPaymentMethods: ['CASH'],
  },
  photos: [],
  pickupLocations: [],
  unavailable: [],
};

describe('offres de l’API', () => {
  it('convertit une offre pour l’affichage et les filtres', () => {
    const offer = toSearchOffer(OFFER);
    expect(offer).toMatchObject({
      id: 'v1',
      category: 'city',
      pricePerDayMillimes: 75_000,
      unlimitedMileage: true,
      instantConfirmation: false,
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
    expect(filterOffers(OFFERS, DEFAULT_FILTERS)).toHaveLength(OFFERS.length);
  });

  it('combine catégorie, boîte de vitesses, plafond de prix et kilométrage', () => {
    const result = filterOffers(OFFERS, {
      ...DEFAULT_FILTERS,
      categories: ['suv', 'compact'],
      transmission: 'AUTOMATIC',
      priceCap: 150_000,
      unlimitedMileageOnly: true,
    });
    expect(result.map((offer) => offer.id)).toEqual(['polo']);
  });

  it('filtre par carburant, nombre de places et confirmation immédiate', () => {
    const ids = (filters: Partial<OfferFilters>) =>
      filterOffers(OFFERS, { ...DEFAULT_FILTERS, ...filters }).map((offer) => offer.id);
    expect(ids({ fuels: ['HYBRID'] })).toEqual(['sportage']);
    expect(ids({ minSeats: 7 })).toEqual(['jogger']);
    expect(ids({ instantOnly: true })).toEqual(['polo', 'sportage']);
  });
});

describe('marques et modèles', () => {
  const groups = brandGroups(OFFERS);
  const kia = groups.find((group) => group.brand === 'Kia');
  if (kia === undefined) {
    throw new Error('Kia attendue dans les offres d’exemple');
  }

  it('regroupe les modèles par marque, triés par ordre alphabétique', () => {
    expect(groups.map((group) => group.brand).slice(0, 3)).toEqual(['Dacia', 'Hyundai', 'Kia']);
    expect(kia.models).toEqual([
      { key: 'Kia Picanto', name: 'Picanto' },
      { key: 'Kia Sportage', name: 'Sportage' },
    ]);
  });

  it('ne propose que les marques et modèles des véhicules en offre', () => {
    const result = brandGroups([
      { brand: 'BMW', model: 'X6' },
      { brand: 'BMW', model: 'Série 3' },
      { brand: 'BMW', model: 'X6' },
      { brand: 'Audi', model: 'A3' },
    ]);
    expect(result).toEqual([
      { brand: 'Audi', models: [{ key: 'Audi A3', name: 'A3' }] },
      {
        brand: 'BMW',
        models: [
          { key: 'BMW Série 3', name: 'Série 3' },
          { key: 'BMW X6', name: 'X6' },
        ],
      },
    ]);
  });

  it('filtre par marque entière ou par modèle précis', () => {
    const ids = (filters: Partial<OfferFilters>) =>
      filterOffers(OFFERS, { ...DEFAULT_FILTERS, ...filters }).map((offer) => offer.id);
    expect(ids({ brands: ['Kia'] })).toEqual(['picanto', 'sportage']);
    expect(ids({ models: ['Kia Sportage', 'Peugeot 208'] })).toEqual(['208', 'sportage']);
    expect(ids({ brands: ['Dacia'], models: ['Kia Picanto'] })).toEqual([
      'picanto',
      'logan',
      'duster',
      'jogger',
    ]);
  });

  it('passe d’une marque entière à ses modèles et inversement', () => {
    const brand = toggleBrand(DEFAULT_FILTERS, kia, true);
    expect(brand).toMatchObject({ brands: ['Kia'], models: [] });

    const withoutPicanto = toggleModel(brand, kia, 'Kia Picanto', false);
    expect(withoutPicanto).toMatchObject({ brands: [], models: ['Kia Sportage'] });

    expect(toggleModel(withoutPicanto, kia, 'Kia Picanto', true)).toMatchObject({
      brands: ['Kia'],
      models: [],
    });
    expect(toggleModel(withoutPicanto, kia, 'Kia Sportage', false).models).toEqual([]);
  });
});

describe('critères actifs', () => {
  const filters: OfferFilters = {
    ...DEFAULT_FILTERS,
    categories: ['suv'],
    models: ['Kia Sportage', 'Mercedes-Benz Classe C'],
    fuels: ['DIESEL'],
    priceCap: 150_000,
    instantOnly: true,
  };

  it('liste chaque critère et retire un critère à la fois', () => {
    const active = listActiveFilters(filters);
    expect(active).toEqual([
      { kind: 'category', value: 'suv' },
      { kind: 'model', value: 'Kia Sportage' },
      { kind: 'model', value: 'Mercedes-Benz Classe C' },
      { kind: 'price', value: 150_000 },
      { kind: 'fuel', value: 'DIESEL' },
      { kind: 'instant' },
    ]);
    expect(removeFilter(filters, { kind: 'price', value: 150_000 }).priceCap).toBeNull();
    expect(removeFilter(filters, { kind: 'fuel', value: 'DIESEL' }).fuels).toEqual([]);
    expect(countActiveFilters(removeFilter(filters, { kind: 'instant' }))).toBe(5);
    expect(removeFilter(filters, { kind: 'model', value: 'Kia Sportage' }).models).toEqual([
      'Mercedes-Benz Classe C',
    ]);
  });

  it('fait l’aller-retour avec l’URL en ignorant les valeurs inconnues', () => {
    const params = new URLSearchParams('location=tunis&sort=priceAsc');
    writeSearchFilters(params, filters, 'rating');
    expect(params.get('location')).toBe('tunis');
    expect(params.get('category')).toBe('suv');
    expect(params.get('maxPrice')).toBe('150');
    expect(params.get('model')).toBe('Kia Sportage,Mercedes-Benz Classe C');
    expect(params.get('sort')).toBe('rating');
    expect(params.has('transmission')).toBe(false);
    expect(parseSearchFilters((key) => params.get(key))).toEqual({ filters, sort: 'rating' });

    const invalid = new URLSearchParams('category=suv,Pick Up!&maxPrice=999&seats=3&sort=x');
    expect(parseSearchFilters((key) => invalid.get(key))).toEqual({
      filters: { ...DEFAULT_FILTERS, categories: ['suv'] },
      sort: 'recommended',
    });
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

describe('countActiveFilters', () => {
  it('compte chaque critère actif', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, categories: ['city', 'suv'], priceCap: 100_000 }),
    ).toBe(3);
  });
});

describe('catégories du référentiel', () => {
  const CATEGORIES: VehicleCategoryInfo[] = [
    {
      id: 'vcat_suv',
      slug: 'suv',
      name: { fr: 'SUV', ar: 'رباعية الدفع', en: 'SUV' },
      description: { fr: '', ar: '', en: '' },
      position: 40,
    },
  ];

  it('affiche le nom traduit, ou le slug mis en forme pour une catégorie inconnue', () => {
    expect(categoryLabel(CATEGORIES, 'suv', 'ar')).toBe('رباعية الدفع');
    expect(categoryLabel(CATEGORIES, 'pick-up', 'fr')).toBe('Pick up');
  });

  it('attribue un dégradé stable, y compris aux nouvelles catégories', () => {
    expect(categoryGradient('suv')).toContain('emerald');
    expect(categoryGradient('pick-up')).toBe(categoryGradient('pick-up'));
    expect(categoryGradient('pick-up')).toMatch(/^from-/);
  });
});

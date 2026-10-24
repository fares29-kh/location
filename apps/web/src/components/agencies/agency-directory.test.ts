import type { PublicAgency } from '@drivetn/types';
import { describe, expect, it } from 'vitest';

import {
  agenciesBounds,
  agencyInitials,
  countDirectoryFilters,
  DEFAULT_DIRECTORY_FILTERS,
  distanceKm,
  filterAgencies,
  sortAgencies,
} from './agency-directory';

function agency(overrides: Partial<PublicAgency>): PublicAgency {
  return {
    id: 'agc',
    name: 'Agence',
    logoUrl: null,
    governorateCode: '11',
    address: 'Rue de Marseille',
    description: '',
    phone: '71123456',
    whatsappPhone: '98123456',
    extraPhones: [],
    rating: null,
    reviewsCount: 0,
    vehiclesCount: 0,
    fromDailyRateMillimes: null,
    categories: [],
    instantConfirmation: false,
    freeCancellationHours: 48,
    latitude: 36.8008,
    longitude: 10.18,
    ...overrides,
  };
}

const GOVERNORATES: Record<string, string> = { '11': 'Tunis', '51': 'Sousse', '82': 'Médenine' };
const governorateName = (code: string) => GOVERNORATES[code] ?? code;

const tunis = agency({ id: 'tunis', name: 'Carthage Rent', rating: 4.6, vehiclesCount: 8 });
const sousse = agency({
  id: 'sousse',
  name: 'Sahel Cars',
  governorateCode: '51',
  address: 'Avenue Léopold Senghor',
  instantConfirmation: true,
  rating: 3.9,
  vehiclesCount: 20,
  latitude: 35.8256,
  longitude: 10.636,
});
const djerba = agency({
  id: 'djerba',
  name: 'Djerba Location',
  governorateCode: '82',
  address: 'Houmt Souk',
  instantConfirmation: true,
  latitude: 33.875,
  longitude: 10.8575,
});
const all = [tunis, sousse, djerba];

describe('filterAgencies', () => {
  it('cherche dans le nom, l’adresse et le gouvernorat sans tenir compte des accents', () => {
    const ids = (query: string) =>
      filterAgencies(all, { ...DEFAULT_DIRECTORY_FILTERS, query }, governorateName).map(
        (item) => item.id,
      );
    expect(ids('sahel')).toEqual(['sousse']);
    expect(ids('leopold')).toEqual(['sousse']);
    expect(ids('MEDENINE')).toEqual(['djerba']);
    expect(ids('  ')).toEqual(['tunis', 'sousse', 'djerba']);
  });

  it('combine gouvernorat, confirmation immédiate et bonne note', () => {
    expect(
      filterAgencies(
        all,
        { ...DEFAULT_DIRECTORY_FILTERS, instantOnly: true, topRated: true },
        governorateName,
      ),
    ).toEqual([]);
    expect(
      filterAgencies(
        all,
        { ...DEFAULT_DIRECTORY_FILTERS, governorate: '82', instantOnly: true },
        governorateName,
      ),
    ).toEqual([djerba]);
  });
});

describe('countDirectoryFilters', () => {
  it('ignore une recherche vide', () => {
    expect(countDirectoryFilters({ ...DEFAULT_DIRECTORY_FILTERS, query: ' ' })).toBe(0);
    expect(
      countDirectoryFilters({ ...DEFAULT_DIRECTORY_FILTERS, governorate: '11', topRated: true }),
    ).toBe(2);
  });
});

describe('sortAgencies', () => {
  it('trie par distance quand la position est connue', () => {
    const monastir = { latitude: 35.7643, longitude: 10.8113 };
    expect(sortAgencies(all, monastir).map((item) => item.id)).toEqual([
      'sousse',
      'tunis',
      'djerba',
    ]);
  });

  it('met en avant les agences les mieux notées sinon', () => {
    expect(sortAgencies(all, null).map((item) => item.id)).toEqual(['tunis', 'sousse', 'djerba']);
  });
});

describe('distanceKm', () => {
  it('mesure environ 120 km entre Tunis et Sousse', () => {
    expect(distanceKm(tunis, sousse)).toBeGreaterThan(110);
    expect(distanceKm(tunis, sousse)).toBeLessThan(130);
  });
});

describe('agencyInitials', () => {
  it('prend les initiales des deux premiers mots', () => {
    expect(agencyInitials('Sahel Cars')).toBe('SC');
    expect(agencyInitials('Rent-a-car Tunis')).toBe('RA');
    expect(agencyInitials('Hertz')).toBe('HE');
    expect(agencyInitials('وكالة النجمة')).toBe('وا');
    expect(agencyInitials('')).toBe('');
  });
});

describe('agenciesBounds', () => {
  it('englobe toutes les agences', () => {
    expect(agenciesBounds(all)).toEqual([
      [10.18, 33.875],
      [10.8575, 36.8008],
    ]);
    expect(agenciesBounds([])).toBeNull();
  });
});

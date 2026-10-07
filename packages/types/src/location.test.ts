import { describe, expect, it } from 'vitest';

import { locationQuerySchema, locationSchema, pickLocalized } from './location';

describe('pickLocalized', () => {
  it('renvoie le texte dans la langue demandée', () => {
    const name = { fr: 'Aéroport', ar: 'مطار', en: 'Airport' };
    expect(pickLocalized(name, 'ar')).toBe('مطار');
  });
});

describe('locationSchema', () => {
  it('accepte un aéroport', () => {
    expect(
      locationSchema.safeParse({
        id: 'loc_1',
        slug: 'aeroport-tunis-carthage',
        type: 'AIRPORT',
        governorateCode: '11',
        iataCode: 'TUN',
        name: {
          fr: 'Aéroport Tunis-Carthage',
          ar: 'مطار تونس قرطاج',
          en: 'Tunis-Carthage Airport',
        },
        latitude: 36.851,
        longitude: 10.227,
      }).success,
    ).toBe(true);
  });
});

describe('locationQuerySchema', () => {
  it('valide le type et le code de gouvernorat', () => {
    expect(locationQuerySchema.safeParse({ type: 'AIRPORT', governorate: '51' }).success).toBe(
      true,
    );
    expect(locationQuerySchema.safeParse({ governorate: 'tunis' }).success).toBe(false);
  });
});

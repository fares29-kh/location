import { describe, expect, it } from 'vitest';

import { buildSearchHref } from './search-href';

describe('buildSearchHref', () => {
  it('renvoie la page de recherche nue sans critère', () => {
    expect(buildSearchHref({})).toBe('/search');
    expect(buildSearchHref({ location: '', pickup: null })).toBe('/search');
  });

  it('encode les critères renseignés, la date de retour sous la clé « return »', () => {
    expect(
      buildSearchHref({
        location: 'aeroport-tunis-carthage',
        pickup: '2026-07-01',
        dropoff: '2026-07-04',
        category: 'suv',
      }),
    ).toBe(
      '/search?location=aeroport-tunis-carthage&pickup=2026-07-01&return=2026-07-04&category=suv',
    );
  });

  it('encode le gouvernorat choisi sans lieu précis', () => {
    expect(buildSearchHref({ governorate: '51', location: null })).toBe('/search?governorate=51');
  });

  it('conserve les filtres et le tri de la page en cours, sans les anciens critères', () => {
    const current = new URLSearchParams('location=tunis&fuel=DIESEL&sort=priceAsc&book=v1');
    expect(buildSearchHref({ location: 'sousse' }, current)).toBe(
      '/search?location=sousse&fuel=DIESEL&sort=priceAsc',
    );
  });
});

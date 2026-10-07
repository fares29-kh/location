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
});

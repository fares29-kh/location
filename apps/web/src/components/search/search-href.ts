import { FILTER_PARAM_KEYS } from './catalog';

/**
 * Construit l'URL de la page de recherche à partir des critères saisis.
 * `current` (paramètres de la page en cours) permet de conserver les filtres et le tri.
 */
export function buildSearchHref(
  criteria: {
    governorate?: string | null;
    location?: string | null;
    pickup?: string | null;
    dropoff?: string | null;
    category?: string | null;
  },
  current?: URLSearchParams,
): string {
  const params = new URLSearchParams();
  const entries: [string, string | null | undefined][] = [
    ['governorate', criteria.governorate],
    ['location', criteria.location],
    ['pickup', criteria.pickup],
    ['return', criteria.dropoff],
    ['category', criteria.category],
  ];
  for (const [key, value] of entries) {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value);
    }
  }
  for (const key of FILTER_PARAM_KEYS) {
    const value = current?.get(key);
    if (!params.has(key) && value !== null && value !== undefined && value !== '') {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query === '' ? '/search' : `/search?${query}`;
}

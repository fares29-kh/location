/** Construit l'URL de la page de recherche à partir des critères saisis. */
export function buildSearchHref(criteria: {
  location?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  category?: string | null;
}): string {
  const params = new URLSearchParams();
  const entries: [string, string | null | undefined][] = [
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
  const query = params.toString();
  return query === '' ? '/search' : `/search?${query}`;
}

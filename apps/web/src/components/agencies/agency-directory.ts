import type { GeoPoint, PublicAgency } from '@drivetn/types';

export const TOP_RATED_MIN = 4;

/** Emprise de la Tunisie continentale et de ses îles ([ouest, sud], [est, nord]). */
export const TUNISIA_BOUNDS: [[number, number], [number, number]] = [
  [7.5, 30.2],
  [11.6, 37.6],
];

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface DirectoryFilters {
  query: string;
  governorate: string | null;
  instantOnly: boolean;
  topRated: boolean;
}

export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = {
  query: '',
  governorate: null,
  instantOnly: false,
  topRated: false,
};

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function countDirectoryFilters(filters: DirectoryFilters): number {
  return [
    normalizeSearch(filters.query) !== '',
    filters.governorate !== null,
    filters.instantOnly,
    filters.topRated,
  ].filter(Boolean).length;
}

/** `governorateName` permet de chercher « Sousse » même si l'adresse ne le mentionne pas. */
export function filterAgencies(
  agencies: readonly PublicAgency[],
  filters: DirectoryFilters,
  governorateName: (code: string) => string,
): PublicAgency[] {
  const query = normalizeSearch(filters.query);
  return agencies.filter(
    (agency) =>
      (filters.governorate === null || agency.governorateCode === filters.governorate) &&
      (!filters.instantOnly || agency.instantConfirmation) &&
      (!filters.topRated || (agency.rating ?? 0) >= TOP_RATED_MIN) &&
      (query === '' ||
        [agency.name, agency.address, governorateName(agency.governorateCode)].some((text) =>
          normalizeSearch(text).includes(query),
        )),
  );
}

/** Distance orthodromique en kilomètres. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sans position, les agences les mieux notées puis les plus fournies passent en premier. */
export function sortAgencies(
  agencies: readonly PublicAgency[],
  origin: GeoPoint | null,
): PublicAgency[] {
  if (origin !== null) {
    return [...agencies].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b));
  }
  return [...agencies].sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      b.vehiclesCount - a.vehiclesCount ||
      a.name.localeCompare(b.name),
  );
}

export function agencyInitials(name: string): string {
  const [first = '', second] = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const initials = second === undefined ? first.slice(0, 2) : first.charAt(0) + second.charAt(0);
  return initials.toUpperCase();
}

/** Recherche Google Maps par nom et adresse : la position affichée n'est qu'indicative. */
export function directionsUrl(agency: Pick<PublicAgency, 'name' | 'address'>): string {
  const query = encodeURIComponent(`${agency.name}, ${agency.address}, Tunisie`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function agenciesBounds(
  agencies: readonly GeoPoint[],
): [[number, number], [number, number]] | null {
  const [first, ...rest] = agencies;
  if (first === undefined) {
    return null;
  }
  let west = first.longitude;
  let east = first.longitude;
  let south = first.latitude;
  let north = first.latitude;
  for (const point of rest) {
    west = Math.min(west, point.longitude);
    east = Math.max(east, point.longitude);
    south = Math.min(south, point.latitude);
    north = Math.max(north, point.latitude);
  }
  return [
    [west, south],
    [east, north],
  ];
}

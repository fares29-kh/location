import {
  FUEL_TYPES,
  type FuelType,
  type Locale,
  type Offer,
  type OfferAgency,
  pickLocalized,
  SLUG_MAX,
  SLUG_PATTERN,
  type VehicleCategoryInfo,
  type VehiclePhoto,
} from '@drivetn/types';

import type { CITIES } from '@/components/home/places';

/** Slug d'une catégorie gérée par l'administration (ex. « suv »). */
export type VehicleCategory = string;

/** Dégradés (classes Tailwind `bg-gradient-to-*`) des catégories d'origine. */
const KNOWN_GRADIENTS: Readonly<Record<string, string>> = {
  city: 'from-sky-500 via-blue-500 to-blue-700',
  compact: 'from-indigo-500 via-indigo-600 to-violet-700',
  sedan: 'from-slate-500 via-slate-600 to-slate-800',
  suv: 'from-emerald-500 via-emerald-600 to-teal-700',
  family: 'from-amber-500 via-orange-500 to-orange-700',
  premium: 'from-zinc-700 via-zinc-800 to-black',
};

/** Dégradés attribués aux catégories ajoutées depuis l'administration. */
const FALLBACK_GRADIENTS = [
  'from-cyan-500 via-cyan-600 to-sky-700',
  'from-rose-500 via-rose-600 to-pink-700',
  'from-lime-500 via-green-600 to-emerald-700',
  'from-fuchsia-500 via-purple-600 to-violet-700',
  'from-orange-500 via-red-500 to-red-700',
  'from-teal-500 via-teal-600 to-cyan-800',
] as const;

/** Dégradé qui illustre une catégorie ; stable pour un même slug. */
export function categoryGradient(slug: string): string {
  const known = KNOWN_GRADIENTS[slug];
  if (known !== undefined) {
    return known;
  }
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length] ?? FALLBACK_GRADIENTS[0];
}

/** Nom traduit d'une catégorie, ou son slug mis en forme si elle n'est plus au référentiel. */
export function categoryLabel(
  categories: readonly VehicleCategoryInfo[],
  slug: string,
  locale: Locale,
): string {
  const category = categories.find((item) => item.slug === slug);
  if (category !== undefined) {
    return pickLocalized(category.name, locale);
  }
  const words = slug.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const SORT_OPTIONS = ['recommended', 'priceAsc', 'priceDesc', 'rating'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Plafonds de prix journalier proposés dans les filtres, en millimes (`null` = sans limite). */
export const PRICE_CAPS = [null, 100_000, 150_000, 250_000] as const;
export type PriceCap = (typeof PRICE_CAPS)[number];

/** Nombre minimal de places proposé dans les filtres (`null` = indifférent). */
export const SEAT_OPTIONS = [null, 5, 7] as const;
export type SeatOption = (typeof SEAT_OPTIONS)[number];

/** Ce dont les filtres et les tris de la recherche ont besoin. */
export interface FilterableOffer {
  brand: string;
  model: string;
  category: VehicleCategory;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  pricePerDayMillimes: number;
  unlimitedMileage: boolean;
  instantConfirmation: boolean;
  /** Note moyenne sur 5, `null` sans avis. */
  rating: number | null;
  reviews: number;
}

export interface SampleOffer extends Omit<
  FilterableOffer,
  'brand' | 'model' | 'instantConfirmation'
> {
  id: string;
  /** Marque et modèle (ex. « Kia Picanto »). */
  model: string;
  bags: number;
  depositMillimes: number;
  rating: number;
  city: (typeof CITIES)[number];
}

/** Offre réelle d'une agence, prête pour l'affichage et les filtres. */
export interface SearchOffer extends FilterableOffer {
  id: string;
  year: number;
  airConditioning: boolean;
  depositMillimes: number;
  mileageLimitKm: number | null;
  agency: OfferAgency;
  /** Photos de l'agence, la première sert de couverture. */
  photos: VehiclePhoto[];
}

export function toSearchOffer(offer: Offer): SearchOffer {
  return {
    id: offer.vehicleId,
    brand: offer.brand,
    model: offer.model,
    year: offer.year,
    category: offer.category,
    transmission: offer.transmission,
    fuel: offer.fuel,
    seats: offer.seats,
    airConditioning: offer.airConditioning,
    pricePerDayMillimes: offer.dailyRateMillimes,
    depositMillimes: offer.depositMillimes,
    mileageLimitKm: offer.mileageLimitKm,
    unlimitedMileage: offer.mileageLimitKm === null,
    instantConfirmation: offer.agency.instantConfirmation,
    rating: offer.agency.rating,
    reviews: offer.agency.reviewsCount,
    agency: offer.agency,
    photos: offer.photos,
  };
}

/** Modèles d'illustration de chaque catégorie (page d'accueil), avec des prix indicatifs. */
export const SAMPLE_OFFERS: readonly SampleOffer[] = [
  {
    id: 'picanto',
    model: 'Kia Picanto',
    category: 'city',
    transmission: 'MANUAL',
    fuel: 'PETROL',
    seats: 4,
    bags: 1,
    pricePerDayMillimes: 75_000,
    depositMillimes: 500_000,
    rating: 4.6,
    reviews: 128,
    unlimitedMileage: true,
    city: 'tunis',
  },
  {
    id: 'i10',
    model: 'Hyundai Grand i10',
    category: 'city',
    transmission: 'MANUAL',
    fuel: 'PETROL',
    seats: 5,
    bags: 2,
    pricePerDayMillimes: 80_000,
    depositMillimes: 500_000,
    rating: 4.5,
    reviews: 96,
    unlimitedMileage: true,
    city: 'sousse',
  },
  {
    id: '208',
    model: 'Peugeot 208',
    category: 'compact',
    transmission: 'MANUAL',
    fuel: 'PETROL',
    seats: 5,
    bags: 2,
    pricePerDayMillimes: 95_000,
    depositMillimes: 700_000,
    rating: 4.7,
    reviews: 211,
    unlimitedMileage: true,
    city: 'tunis',
  },
  {
    id: 'clio',
    model: 'Renault Clio',
    category: 'compact',
    transmission: 'AUTOMATIC',
    fuel: 'PETROL',
    seats: 5,
    bags: 2,
    pricePerDayMillimes: 115_000,
    depositMillimes: 800_000,
    rating: 4.4,
    reviews: 74,
    unlimitedMileage: false,
    city: 'hammamet',
  },
  {
    id: 'polo',
    model: 'Volkswagen Polo',
    category: 'compact',
    transmission: 'AUTOMATIC',
    fuel: 'PETROL',
    seats: 5,
    bags: 2,
    pricePerDayMillimes: 120_000,
    depositMillimes: 800_000,
    rating: 4.8,
    reviews: 58,
    unlimitedMileage: true,
    city: 'sfax',
  },
  {
    id: 'logan',
    model: 'Dacia Logan',
    category: 'sedan',
    transmission: 'MANUAL',
    fuel: 'DIESEL',
    seats: 5,
    bags: 3,
    pricePerDayMillimes: 90_000,
    depositMillimes: 600_000,
    rating: 4.3,
    reviews: 143,
    unlimitedMileage: true,
    city: 'bizerte',
  },
  {
    id: 'accent',
    model: 'Hyundai Accent',
    category: 'sedan',
    transmission: 'AUTOMATIC',
    fuel: 'PETROL',
    seats: 5,
    bags: 3,
    pricePerDayMillimes: 125_000,
    depositMillimes: 800_000,
    rating: 4.6,
    reviews: 87,
    unlimitedMileage: true,
    city: 'sousse',
  },
  {
    id: 'duster',
    model: 'Dacia Duster',
    category: 'suv',
    transmission: 'MANUAL',
    fuel: 'DIESEL',
    seats: 5,
    bags: 3,
    pricePerDayMillimes: 140_000,
    depositMillimes: 1_000_000,
    rating: 4.5,
    reviews: 162,
    unlimitedMileage: true,
    city: 'tunis',
  },
  {
    id: 'sportage',
    model: 'Kia Sportage',
    category: 'suv',
    transmission: 'AUTOMATIC',
    fuel: 'HYBRID',
    seats: 5,
    bags: 4,
    pricePerDayMillimes: 210_000,
    depositMillimes: 1_500_000,
    rating: 4.8,
    reviews: 49,
    unlimitedMileage: true,
    city: 'hammamet',
  },
  {
    id: '3008',
    model: 'Peugeot 3008',
    category: 'suv',
    transmission: 'AUTOMATIC',
    fuel: 'DIESEL',
    seats: 5,
    bags: 4,
    pricePerDayMillimes: 230_000,
    depositMillimes: 1_500_000,
    rating: 4.7,
    reviews: 66,
    unlimitedMileage: true,
    city: 'sousse',
  },
  {
    id: 'jogger',
    model: 'Dacia Jogger',
    category: 'family',
    transmission: 'MANUAL',
    fuel: 'PETROL',
    seats: 7,
    bags: 3,
    pricePerDayMillimes: 160_000,
    depositMillimes: 1_000_000,
    rating: 4.4,
    reviews: 37,
    unlimitedMileage: true,
    city: 'sfax',
  },
  {
    id: 'classC',
    model: 'Mercedes Classe C',
    category: 'premium',
    transmission: 'AUTOMATIC',
    fuel: 'DIESEL',
    seats: 5,
    bags: 3,
    pricePerDayMillimes: 320_000,
    depositMillimes: 3_000_000,
    rating: 4.9,
    reviews: 22,
    unlimitedMileage: false,
    city: 'tunis',
  },
];

/** Identifiant d'un modèle, marque comprise (ex. « Kia Sportage »). */
export function modelKey(offer: Pick<FilterableOffer, 'brand' | 'model'>): string {
  return `${offer.brand} ${offer.model}`;
}

export interface BrandGroup {
  brand: string;
  models: readonly { key: string; name: string }[];
}

/**
 * Marques et modèles des véhicules réellement proposés par les agences, triés par ordre
 * alphabétique. Les noms viennent du référentiel de l'administration (imposé à la saisie).
 */
export function brandGroups(
  offers: readonly Pick<FilterableOffer, 'brand' | 'model'>[],
): BrandGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const offer of offers) {
    const models = groups.get(offer.brand) ?? new Set<string>();
    models.add(offer.model);
    groups.set(offer.brand, models);
  }
  const compare = (a: string, b: string) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });
  return [...groups.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([brand, models]) => ({
      brand,
      models: [...models]
        .sort(compare)
        .map((name) => ({ key: modelKey({ brand, model: name }), name })),
    }));
}

export interface OfferFilters {
  categories: readonly VehicleCategory[];
  /** Marques entières retenues. */
  brands: readonly string[];
  /** Modèles retenus individuellement (voir `modelKey`), hors marques entières. */
  models: readonly string[];
  transmission: Transmission | 'ALL';
  fuels: readonly FuelType[];
  minSeats: SeatOption;
  priceCap: PriceCap;
  unlimitedMileageOnly: boolean;
  instantOnly: boolean;
}

export const DEFAULT_FILTERS: OfferFilters = {
  categories: [],
  brands: [],
  models: [],
  transmission: 'ALL',
  fuels: [],
  minSeats: null,
  priceCap: null,
  unlimitedMileageOnly: false,
  instantOnly: false,
};

/** Critère actif, affiché sous forme de pastille que le client peut retirer. */
export type ActiveFilter =
  | { kind: 'category'; value: VehicleCategory }
  | { kind: 'brand'; value: string }
  | { kind: 'model'; value: string }
  | { kind: 'transmission'; value: Transmission }
  | { kind: 'fuel'; value: FuelType }
  | { kind: 'seats'; value: number }
  | { kind: 'price'; value: number }
  | { kind: 'mileage' }
  | { kind: 'instant' };

export function listActiveFilters(filters: OfferFilters): ActiveFilter[] {
  const active: ActiveFilter[] = [
    ...filters.categories.map((value) => ({ kind: 'category' as const, value })),
    ...filters.brands.map((value) => ({ kind: 'brand' as const, value })),
    ...filters.models.map((value) => ({ kind: 'model' as const, value })),
  ];
  if (filters.priceCap !== null) {
    active.push({ kind: 'price', value: filters.priceCap });
  }
  if (filters.transmission !== 'ALL') {
    active.push({ kind: 'transmission', value: filters.transmission });
  }
  if (filters.minSeats !== null) {
    active.push({ kind: 'seats', value: filters.minSeats });
  }
  active.push(...filters.fuels.map((value) => ({ kind: 'fuel' as const, value })));
  if (filters.unlimitedMileageOnly) {
    active.push({ kind: 'mileage' });
  }
  if (filters.instantOnly) {
    active.push({ kind: 'instant' });
  }
  return active;
}

export function removeFilter(filters: OfferFilters, active: ActiveFilter): OfferFilters {
  switch (active.kind) {
    case 'category':
      return { ...filters, categories: filters.categories.filter((item) => item !== active.value) };
    case 'brand':
      return { ...filters, brands: filters.brands.filter((item) => item !== active.value) };
    case 'model':
      return { ...filters, models: filters.models.filter((item) => item !== active.value) };
    case 'transmission':
      return { ...filters, transmission: 'ALL' };
    case 'fuel':
      return { ...filters, fuels: filters.fuels.filter((item) => item !== active.value) };
    case 'seats':
      return { ...filters, minSeats: null };
    case 'price':
      return { ...filters, priceCap: null };
    case 'mileage':
      return { ...filters, unlimitedMileageOnly: false };
    case 'instant':
      return { ...filters, instantOnly: false };
  }
}

export function countActiveFilters(filters: OfferFilters): number {
  return listActiveFilters(filters).length;
}

/** Coche ou décoche une marque entière (ses modèles cochés un à un sont alors oubliés). */
export function toggleBrand(
  filters: OfferFilters,
  group: BrandGroup,
  checked: boolean,
): OfferFilters {
  const keys = group.models.map((model) => model.key);
  const brands = filters.brands.filter((brand) => brand !== group.brand);
  return {
    ...filters,
    brands: checked ? [...brands, group.brand] : brands,
    models: filters.models.filter((key) => !keys.includes(key)),
  };
}

/** Coche ou décoche un modèle ; tous les modèles d'une marque cochés reviennent à la marque. */
export function toggleModel(
  filters: OfferFilters,
  group: BrandGroup,
  key: string,
  checked: boolean,
): OfferFilters {
  const keys = group.models.map((model) => model.key);
  if (filters.brands.includes(group.brand)) {
    return checked
      ? filters
      : {
          ...filters,
          brands: filters.brands.filter((brand) => brand !== group.brand),
          models: [...filters.models, ...keys.filter((item) => item !== key)],
        };
  }
  if (!checked) {
    return { ...filters, models: filters.models.filter((item) => item !== key) };
  }
  const models = [...filters.models, key];
  return keys.every((item) => models.includes(item))
    ? toggleBrand(filters, group, true)
    : { ...filters, models };
}

export function filterOffers<T extends FilterableOffer>(
  offers: readonly T[],
  filters: OfferFilters,
): T[] {
  return offers.filter(
    (offer) =>
      (filters.categories.length === 0 || filters.categories.includes(offer.category)) &&
      ((filters.brands.length === 0 && filters.models.length === 0) ||
        filters.brands.includes(offer.brand) ||
        filters.models.includes(modelKey(offer))) &&
      (filters.transmission === 'ALL' || offer.transmission === filters.transmission) &&
      (filters.fuels.length === 0 || filters.fuels.includes(offer.fuel)) &&
      (filters.minSeats === null || offer.seats >= filters.minSeats) &&
      (filters.priceCap === null || offer.pricePerDayMillimes <= filters.priceCap) &&
      (!filters.unlimitedMileageOnly || offer.unlimitedMileage) &&
      (!filters.instantOnly || offer.instantConfirmation),
  );
}

/** Paramètres d'URL propres aux filtres et au tri (conservés d'une recherche à l'autre). */
export const FILTER_PARAM_KEYS = [
  'category',
  'brand',
  'model',
  'maxPrice',
  'transmission',
  'seats',
  'fuel',
  'unlimited',
  'instant',
  'sort',
] as const;

function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (value === null) {
    return [];
  }
  const items = value.split(',');
  return allowed.filter((item) => items.includes(item));
}

const MAX_NAMES = 20;
const MAX_NAME_LENGTH = 60;

/** Slugs de catégories : la liste vient de l'administration, on vérifie seulement leur forme. */
function parseSlugs(value: string | null): string[] {
  if (value === null) {
    return [];
  }
  const slugs = value
    .split(',')
    .map((slug) => slug.trim())
    .filter((slug) => slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug));
  return [...new Set(slugs)].slice(0, MAX_NAMES);
}

/** Noms libres (marques, modèles) : la liste dépend des offres, on borne seulement la saisie. */
function parseNames(value: string | null): string[] {
  if (value === null) {
    return [];
  }
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= MAX_NAME_LENGTH);
  return [...new Set(names)].slice(0, MAX_NAMES);
}

/** Lit les filtres et le tri depuis l'URL en ignorant les valeurs inconnues. */
export function parseSearchFilters(get: (key: string) => string | null): {
  filters: OfferFilters;
  sort: SortOption;
} {
  const maxPrice = Number(get('maxPrice')) * 1000;
  const seats = Number(get('seats'));
  return {
    filters: {
      categories: parseSlugs(get('category')),
      brands: parseNames(get('brand')),
      models: parseNames(get('model')),
      transmission: TRANSMISSIONS.find((item) => item === get('transmission')) ?? 'ALL',
      fuels: parseList(get('fuel'), FUEL_TYPES),
      minSeats: SEAT_OPTIONS.find((option) => option !== null && option === seats) ?? null,
      priceCap: PRICE_CAPS.find((cap) => cap !== null && cap === maxPrice) ?? null,
      unlimitedMileageOnly: get('unlimited') === '1',
      instantOnly: get('instant') === '1',
    },
    sort: SORT_OPTIONS.find((option) => option === get('sort')) ?? 'recommended',
  };
}

/** Reporte les filtres et le tri dans l'URL ; les valeurs par défaut n'y figurent pas. */
export function writeSearchFilters(
  params: URLSearchParams,
  filters: OfferFilters,
  sort: SortOption,
): void {
  const values: Record<(typeof FILTER_PARAM_KEYS)[number], string | null> = {
    category: filters.categories.length > 0 ? filters.categories.join(',') : null,
    brand: filters.brands.length > 0 ? filters.brands.join(',') : null,
    model: filters.models.length > 0 ? filters.models.join(',') : null,
    maxPrice: filters.priceCap === null ? null : String(filters.priceCap / 1000),
    transmission: filters.transmission === 'ALL' ? null : filters.transmission,
    seats: filters.minSeats === null ? null : String(filters.minSeats),
    fuel: filters.fuels.length > 0 ? filters.fuels.join(',') : null,
    unlimited: filters.unlimitedMileageOnly ? '1' : null,
    instant: filters.instantOnly ? '1' : null,
    sort: sort === 'recommended' ? null : sort,
  };
  for (const key of FILTER_PARAM_KEYS) {
    const value = values[key];
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
}

export function sortOffers<
  T extends Pick<FilterableOffer, 'pricePerDayMillimes' | 'rating' | 'reviews'>,
>(offers: readonly T[], sort: SortOption): T[] {
  const sorted = [...offers];
  switch (sort) {
    case 'priceAsc':
      return sorted.sort((a, b) => a.pricePerDayMillimes - b.pricePerDayMillimes);
    case 'priceDesc':
      return sorted.sort((a, b) => b.pricePerDayMillimes - a.pricePerDayMillimes);
    case 'rating':
      return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviews - a.reviews);
    case 'recommended':
      return sorted;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Nombre de jours facturés entre deux dates `AAAA-MM-JJ` (minimum 1), ou `null` si invalide. */
export function rentalDays(pickup: string | null, dropoff: string | null): number | null {
  if (pickup === null || dropoff === null || !ISO_DATE.test(pickup) || !ISO_DATE.test(dropoff)) {
    return null;
  }
  const start = Date.parse(`${pickup}T00:00:00Z`);
  const end = Date.parse(`${dropoff}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }
  return Math.max(1, Math.round((end - start) / DAY_MS));
}

export interface RentalDates {
  pickup: string;
  dropoff: string;
}

/** Dates réservables : bien formées, retour après le départ et départ à partir d'aujourd'hui. */
export function bookableDates(
  pickup: string | null,
  dropoff: string | null,
  today: string,
): RentalDates | null {
  if (pickup === null || dropoff === null || !ISO_DATE.test(pickup) || !ISO_DATE.test(dropoff)) {
    return null;
  }
  return pickup >= today && dropoff > pickup ? { pickup, dropoff } : null;
}

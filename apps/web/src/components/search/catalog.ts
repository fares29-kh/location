import type { CITIES } from '@/components/home/places';

export const VEHICLE_CATEGORIES = ['city', 'compact', 'sedan', 'suv', 'family', 'premium'] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

/** Dégradé (classes Tailwind `bg-gradient-to-*`) qui illustre chaque catégorie. */
export const CATEGORY_GRADIENTS: Record<VehicleCategory, string> = {
  city: 'from-sky-500 via-blue-500 to-blue-700',
  compact: 'from-indigo-500 via-indigo-600 to-violet-700',
  sedan: 'from-slate-500 via-slate-600 to-slate-800',
  suv: 'from-emerald-500 via-emerald-600 to-teal-700',
  family: 'from-amber-500 via-orange-500 to-orange-700',
  premium: 'from-zinc-700 via-zinc-800 to-black',
};

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export type FuelType = 'PETROL' | 'DIESEL' | 'HYBRID';

export const SORT_OPTIONS = ['recommended', 'priceAsc', 'priceDesc', 'rating'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Plafonds de prix journalier proposés dans les filtres, en millimes (`null` = sans limite). */
export const PRICE_CAPS = [null, 100_000, 150_000, 250_000] as const;
export type PriceCap = (typeof PRICE_CAPS)[number];

export interface SampleOffer {
  id: string;
  model: string;
  category: VehicleCategory;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  bags: number;
  pricePerDayMillimes: number;
  depositMillimes: number;
  rating: number;
  reviews: number;
  unlimitedMileage: boolean;
  city: (typeof CITIES)[number];
}

/**
 * Offres d'illustration affichées tant que les agences ne publient pas encore leur flotte.
 * Elles sont signalées comme « aperçu » dans l'interface.
 */
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

export interface OfferFilters {
  categories: readonly VehicleCategory[];
  transmission: Transmission | 'ALL';
  priceCap: PriceCap;
  unlimitedMileageOnly: boolean;
}

export const DEFAULT_FILTERS: OfferFilters = {
  categories: [],
  transmission: 'ALL',
  priceCap: null,
  unlimitedMileageOnly: false,
};

export function countActiveFilters(filters: OfferFilters): number {
  return (
    filters.categories.length +
    (filters.transmission === 'ALL' ? 0 : 1) +
    (filters.priceCap === null ? 0 : 1) +
    (filters.unlimitedMileageOnly ? 1 : 0)
  );
}

export function filterOffers(offers: readonly SampleOffer[], filters: OfferFilters): SampleOffer[] {
  return offers.filter(
    (offer) =>
      (filters.categories.length === 0 || filters.categories.includes(offer.category)) &&
      (filters.transmission === 'ALL' || offer.transmission === filters.transmission) &&
      (filters.priceCap === null || offer.pricePerDayMillimes <= filters.priceCap) &&
      (!filters.unlimitedMileageOnly || offer.unlimitedMileage),
  );
}

export function sortOffers(offers: readonly SampleOffer[], sort: SortOption): SampleOffer[] {
  const sorted = [...offers];
  switch (sort) {
    case 'priceAsc':
      return sorted.sort((a, b) => a.pricePerDayMillimes - b.pricePerDayMillimes);
    case 'priceDesc':
      return sorted.sort((a, b) => b.pricePerDayMillimes - a.pricePerDayMillimes);
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
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

export function isVehicleCategory(value: string | null | undefined): value is VehicleCategory {
  return VEHICLE_CATEGORIES.some((category) => category === value);
}

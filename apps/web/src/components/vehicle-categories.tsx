'use client';

import { DEFAULT_LOCALE, isLocale, pickLocalized, type VehicleCategoryInfo } from '@drivetn/types';
import { useLocale } from 'next-intl';
import { createContext, type ReactNode, useCallback, useContext } from 'react';

import { categoryLabel } from './search/catalog';

const VehicleCategoriesContext = createContext<readonly VehicleCategoryInfo[]>([]);

/** Catégories de véhicules de l'administration, chargées côté serveur par le layout du portail. */
export function VehicleCategoriesProvider({
  categories,
  children,
}: {
  categories: readonly VehicleCategoryInfo[];
  children: ReactNode;
}) {
  return (
    <VehicleCategoriesContext.Provider value={categories}>
      {children}
    </VehicleCategoriesContext.Provider>
  );
}

export function useVehicleCategories(): readonly VehicleCategoryInfo[] {
  return useContext(VehicleCategoriesContext);
}

/** Nom traduit d'une catégorie à partir de son slug. */
export function useCategoryLabel(): (slug: string) => string {
  const categories = useVehicleCategories();
  const locale = useLocale();
  return useCallback(
    (slug: string) => categoryLabel(categories, slug, isLocale(locale) ? locale : DEFAULT_LOCALE),
    [categories, locale],
  );
}

/** Description traduite d'une catégorie (chaîne vide si elle n'en a pas). */
export function useCategoryDescription(): (slug: string) => string {
  const categories = useVehicleCategories();
  const locale = useLocale();
  return useCallback(
    (slug: string) => {
      const category = categories.find((item) => item.slug === slug);
      return category === undefined
        ? ''
        : pickLocalized(category.description, isLocale(locale) ? locale : DEFAULT_LOCALE);
    },
    [categories, locale],
  );
}

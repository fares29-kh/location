import {
  type VehicleBrandInfo,
  vehicleBrandInfoSchema,
  type VehicleCategoryInfo,
  vehicleCategoryInfoSchema,
} from '@drivetn/types';

import { fetchReference } from './locations';

/** Les modifications de l'administration apparaissent au plus tard après ce délai. */
const CATALOG_REVALIDATE_SECONDS = 60;

/** Catégories de véhicules gérées par l'administration, dans leur ordre d'affichage. */
export function fetchVehicleCategories(): Promise<VehicleCategoryInfo[]> {
  return fetchReference(
    '/catalog/categories',
    vehicleCategoryInfoSchema,
    CATALOG_REVALIDATE_SECONDS,
  );
}

/** Marques de véhicules gérées par l'administration, par ordre alphabétique. */
export function fetchVehicleBrands(): Promise<VehicleBrandInfo[]> {
  return fetchReference('/catalog/brands', vehicleBrandInfoSchema, CATALOG_REVALIDATE_SECONDS);
}

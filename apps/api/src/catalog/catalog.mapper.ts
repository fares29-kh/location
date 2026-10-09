import type { VehicleBrandInfo, VehicleCategoryInfo } from '@drivetn/types';
import type { VehicleBrand, VehicleCategory } from '@prisma/client';

export const CATEGORY_ORDER = [{ position: 'asc' }, { nameFr: 'asc' }] as const;

export function toCategoryInfo(row: VehicleCategory): VehicleCategoryInfo {
  return {
    id: row.id,
    slug: row.slug,
    name: { fr: row.nameFr, ar: row.nameAr, en: row.nameEn },
    description: { fr: row.descriptionFr, ar: row.descriptionAr, en: row.descriptionEn },
    position: row.position,
  };
}

/** Ordre d'affichage des marques et modèles : alphabétique, « 208 » avant « 2008 ». */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });
}

export function toBrandInfo(
  row: VehicleBrand & { models: readonly { name: string }[] },
): VehicleBrandInfo {
  return {
    id: row.id,
    name: row.name,
    models: row.models.map((model) => model.name).sort(compareNames),
  };
}

import type { Vehicle } from '@/lib/agency/types';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** Recherche par marque, modèle ou immatriculation, sans accents ni espaces. */
export function matchesVehicleSearch(
  vehicle: Pick<Vehicle, 'brand' | 'model' | 'plateNumber'>,
  search: string,
): boolean {
  const needle = normalize(search);
  return (
    needle.length === 0 ||
    normalize(`${vehicle.brand}${vehicle.model}${vehicle.plateNumber ?? ''}`).includes(needle)
  );
}

import {
  type Governorate,
  governorateSchema,
  locationSchema,
  type PickupLocation,
} from '@drivetn/types';
import { z } from 'zod';

import { getServerEnv } from '@/env';

const LOCATIONS_TIMEOUT_MS = 3_000;
const LOCATIONS_REVALIDATE_SECONDS = 600;

/** Liste d'un référentiel public (mise en cache par Next.js) ; vide si l'API est injoignable. */
export async function fetchReference<T extends z.ZodType>(
  path: string,
  schema: T,
  revalidateSeconds = LOCATIONS_REVALIDATE_SECONDS,
): Promise<z.output<T>[]> {
  try {
    const response = await fetch(`${getServerEnv().API_INTERNAL_URL}/api/v1${path}`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(LOCATIONS_TIMEOUT_MS),
    });
    if (!response.ok) {
      return [];
    }
    const result = z.array(schema).safeParse(await response.json());
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/** Gouvernorats du référentiel public ; liste vide si l'API est injoignable. */
export function fetchGovernorates(): Promise<Governorate[]> {
  return fetchReference('/locations/governorates', governorateSchema);
}

/** Lieux de prise en charge actifs ; liste vide si l'API est injoignable. */
export function fetchPickupLocations(): Promise<PickupLocation[]> {
  return fetchReference('/locations', locationSchema);
}

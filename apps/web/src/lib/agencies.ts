import { type PublicAgency, publicAgencySchema } from '@drivetn/types';
import { z } from 'zod';

import { getServerEnv } from '@/env';

const AGENCIES_TIMEOUT_MS = 3_000;

/**
 * Agences actives de l'annuaire public ; `null` si l'API est injoignable. Jamais mis en cache :
 * un changement de nom, de logo ou de statut doit apparaître immédiatement.
 */
export async function fetchPublicAgencies(): Promise<PublicAgency[] | null> {
  try {
    const response = await fetch(`${getServerEnv().API_INTERNAL_URL}/api/v1/agencies`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(AGENCIES_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const result = z.array(publicAgencySchema).safeParse(await response.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

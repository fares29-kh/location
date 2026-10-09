import { type PublicAgency, publicAgencySchema } from '@drivetn/types';
import { z } from 'zod';

import { getServerEnv } from '@/env';

const AGENCIES_TIMEOUT_MS = 3_000;
const AGENCIES_REVALIDATE_SECONDS = 300;

/** Agences actives de l'annuaire public ; `null` si l'API est injoignable. */
export async function fetchPublicAgencies(): Promise<PublicAgency[] | null> {
  try {
    const response = await fetch(`${getServerEnv().API_INTERNAL_URL}/api/v1/agencies`, {
      next: { revalidate: AGENCIES_REVALIDATE_SECONDS },
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

import { type HealthResponse, healthResponseSchema } from '@drivetn/types';

import { getServerEnv } from '@/env';

const HEALTH_TIMEOUT_MS = 3_000;

/** Renvoie l'état de l'API, ou `null` si elle est injoignable ou répond un format inattendu. */
export async function fetchApiHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${getServerEnv().API_INTERNAL_URL}/api/v1/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const result = healthResponseSchema.safeParse(await response.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

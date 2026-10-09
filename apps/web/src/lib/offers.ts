import type { Offer, OfferSearchResult } from '@drivetn/types';
import { z } from 'zod';

import { getServerEnv } from '@/env';

const OFFERS_TIMEOUT_MS = 5_000;

const offerSearchResultSchema = z.object({
  offers: z.array(z.custom<Offer>((value) => typeof value === 'object' && value !== null)),
  days: z.number().int().positive().nullable(),
});

export interface OfferQuery {
  location: string | null;
  /** Code du gouvernorat, pris en compte quand aucun lieu n'est choisi. */
  governorate: string | null;
  pickup: string | null;
  dropoff: string | null;
}

/** Offres disponibles (rendu serveur, sans cache) ; `null` si l'API est injoignable. */
export async function fetchOffers(query: OfferQuery): Promise<OfferSearchResult | null> {
  const params = new URLSearchParams();
  if (query.location !== null) {
    params.set('location', query.location);
  } else if (query.governorate !== null) {
    params.set('governorate', query.governorate);
  }
  if (query.pickup !== null && query.dropoff !== null) {
    params.set('pickup', query.pickup);
    params.set('return', query.dropoff);
  }
  try {
    const response = await fetch(
      `${getServerEnv().API_INTERNAL_URL}/api/v1/offers?${params.toString()}`,
      { cache: 'no-store', signal: AbortSignal.timeout(OFFERS_TIMEOUT_MS) },
    );
    if (!response.ok) {
      return null;
    }
    const result = offerSearchResultSchema.safeParse(await response.json());
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

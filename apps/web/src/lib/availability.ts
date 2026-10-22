import type { UnavailableRange } from '@drivetn/types';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const availabilitySchema = z.object({
  vehicleId: z.string(),
  unavailable: z.array(
    z.object({
      pickup: z.string(),
      return: z.string(),
    }),
  ),
});

/** Dates déjà prises pour une voiture, relues à chaque ouverture du formulaire. */
export function useVehicleAvailability(vehicleId: string) {
  return useQuery({
    queryKey: ['vehicle-availability', vehicleId],
    queryFn: ({ signal }) =>
      apiFetch(`/offers/${encodeURIComponent(vehicleId)}/availability`, {
        schema: availabilitySchema,
        signal,
      }),
    staleTime: 0,
  });
}

export type { UnavailableRange };

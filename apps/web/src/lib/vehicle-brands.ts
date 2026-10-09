'use client';

import { vehicleBrandInfoSchema } from '@drivetn/types';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const BRANDS_STALE_MS = 5 * 60_000;

/** Marques et modèles du référentiel de l'administration, proposés aux agences pour leur flotte. */
export function useVehicleBrands() {
  return useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => apiFetch('/catalog/brands', { schema: z.array(vehicleBrandInfoSchema) }),
    staleTime: BRANDS_STALE_MS,
  });
}

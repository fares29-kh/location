'use client';

import type { PublicReview } from '@drivetn/types';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const publicReviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  comment: z.string(),
  author: z.string(),
  createdAt: z.string(),
  reply: z.string().nullable(),
  repliedAt: z.string().nullable(),
}) satisfies z.ZodType<PublicReview>;

/** Avis publiés d'une agence, relus avant une réservation. */
export function usePublicReviews(agencyId: string) {
  return useQuery({
    queryKey: ['public-reviews', agencyId],
    queryFn: ({ signal }) =>
      apiFetch(`/agencies/${encodeURIComponent(agencyId)}/reviews`, {
        schema: z.array(publicReviewSchema),
        signal,
      }),
    staleTime: 60_000,
  });
}

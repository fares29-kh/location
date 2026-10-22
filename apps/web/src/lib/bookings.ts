'use client';

import type {
  CancelBookingInput,
  CreateBookingInput,
  CreateReviewInput,
  CustomerBooking,
} from '@drivetn/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const customerBookingSchema = z.custom<CustomerBooking>(
  (value) => typeof value === 'object' && value !== null,
);

export const myBookingsKey = ['client', 'bookings'] as const;

export function useMyBookings() {
  return useQuery({
    queryKey: myBookingsKey,
    queryFn: ({ signal }) =>
      apiFetch('/bookings/mine', { schema: z.array(customerBookingSchema), signal }),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      apiFetch('/bookings', { method: 'POST', body: input, schema: customerBookingSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myBookingsKey }),
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateReviewInput }) =>
      apiFetch(`/bookings/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: input,
        schema: customerBookingSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomerBooking[]>(myBookingsKey, (current) =>
        current?.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      return queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CancelBookingInput }) =>
      apiFetch(`/bookings/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: input,
        schema: customerBookingSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomerBooking[]>(myBookingsKey, (current) =>
        current?.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
    },
  });
}

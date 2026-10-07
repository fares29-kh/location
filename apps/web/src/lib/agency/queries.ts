'use client';

import type {
  AgencyProfileInput,
  BookingTransitionInput,
  RecordPaymentInput,
  RentalConditions,
  VehicleInput,
  VehicleStatus,
} from '@drivetn/types';
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { agencyApi } from './api';
import type { DayKey } from './dates';
import type {
  AgencySettings,
  BookingQuery,
  BookingView,
  CustomerQuery,
  PaymentQuery,
  ReviewFilter,
} from './types';

export const agencyKeys = {
  all: ['agency'] as const,
  dashboard: () => [...agencyKeys.all, 'dashboard'] as const,
  navCounts: () => [...agencyKeys.all, 'nav-counts'] as const,
  bookings: () => [...agencyKeys.all, 'bookings'] as const,
  bookingList: (query: BookingQuery) => [...agencyKeys.bookings(), 'list', query] as const,
  booking: (id: string) => [...agencyKeys.bookings(), 'detail', id] as const,
  planning: (from: DayKey, days: number) => [...agencyKeys.all, 'planning', from, days] as const,
  vehicles: () => [...agencyKeys.all, 'vehicles'] as const,
  customers: () => [...agencyKeys.all, 'customers'] as const,
  customerList: (query: CustomerQuery) => [...agencyKeys.customers(), 'list', query] as const,
  customer: (id: string) => [...agencyKeys.customers(), 'detail', id] as const,
  payments: (query: PaymentQuery) => [...agencyKeys.all, 'payments', query] as const,
  reviews: (filter: ReviewFilter) => [...agencyKeys.all, 'reviews', filter] as const,
  settings: () => [...agencyKeys.all, 'settings'] as const,
};

/** Une action métier touche plusieurs écrans (tableau de bord, planning, clients…) : on rafraîchit tout l'espace. */
function invalidateAgency(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: agencyKeys.all });
}

export function useDashboard() {
  return useQuery({ queryKey: agencyKeys.dashboard(), queryFn: () => agencyApi.getDashboard() });
}

export function useNavCounts() {
  return useQuery({
    queryKey: agencyKeys.navCounts(),
    queryFn: () => agencyApi.getNavCounts(),
    refetchInterval: 60_000,
  });
}

export function useBookings(query: BookingQuery) {
  return useQuery({
    queryKey: agencyKeys.bookingList(query),
    queryFn: () => agencyApi.listBookings(query),
    placeholderData: keepPreviousData,
  });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: agencyKeys.booking(id), queryFn: () => agencyApi.getBooking(id) });
}

export function useBookingTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookingTransitionInput }) =>
      agencyApi.transitionBooking(id, input),
    onSuccess: (booking: BookingView) => {
      queryClient.setQueryData(agencyKeys.booking(booking.id), booking);
      return invalidateAgency(queryClient);
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: RecordPaymentInput }) =>
      agencyApi.recordPayment(bookingId, input),
    onSuccess: (booking: BookingView) => {
      queryClient.setQueryData(agencyKeys.booking(booking.id), booking);
      return invalidateAgency(queryClient);
    },
  });
}

export function usePlanning(from: DayKey, days: number) {
  return useQuery({
    queryKey: agencyKeys.planning(from, days),
    queryFn: () => agencyApi.getPlanning(from, days),
    placeholderData: keepPreviousData,
  });
}

export function useVehicles() {
  return useQuery({ queryKey: agencyKeys.vehicles(), queryFn: () => agencyApi.listVehicles() });
}

export function useSaveVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: VehicleInput }) =>
      id === null ? agencyApi.createVehicle(input) : agencyApi.updateVehicle(id, input),
    onSuccess: () => invalidateAgency(queryClient),
  });
}

export function useVehicleStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VehicleStatus }) =>
      agencyApi.setVehicleStatus(id, status),
    onSuccess: () => invalidateAgency(queryClient),
  });
}

export function useCustomers(query: CustomerQuery) {
  return useQuery({
    queryKey: agencyKeys.customerList(query),
    queryFn: () => agencyApi.listCustomers(query),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: agencyKeys.customer(id ?? ''),
    queryFn: () => agencyApi.getCustomer(id ?? ''),
    enabled: id !== null,
  });
}

export function usePayments(query: PaymentQuery) {
  return useQuery({
    queryKey: agencyKeys.payments(query),
    queryFn: () => agencyApi.listPayments(query),
    placeholderData: keepPreviousData,
  });
}

export function useReviews(filter: ReviewFilter) {
  return useQuery({
    queryKey: agencyKeys.reviews(filter),
    queryFn: () => agencyApi.listReviews(filter),
    placeholderData: keepPreviousData,
  });
}

export function useReplyToReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      agencyApi.replyToReview(id, reply),
    onSuccess: () => invalidateAgency(queryClient),
  });
}

export function useAgencySettings() {
  return useQuery({ queryKey: agencyKeys.settings(), queryFn: () => agencyApi.getSettings() });
}

function useSettingsMutation<TInput>(mutationFn: (input: TInput) => Promise<AgencySettings>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (settings) => {
      queryClient.setQueryData(agencyKeys.settings(), settings);
    },
  });
}

export function useUpdateProfile() {
  return useSettingsMutation((input: AgencyProfileInput) => agencyApi.updateProfile(input));
}

export function useUpdateConditions() {
  return useSettingsMutation((input: RentalConditions) => agencyApi.updateConditions(input));
}

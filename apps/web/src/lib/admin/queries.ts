'use client';

import type {
  AgencyDecisionInput,
  PaymentMethod,
  PlatformSettings,
  ReviewModerationInput,
  UserStatusInput,
} from '@drivetn/types';
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminApi } from './api';
import type {
  AgencyQuery,
  AuditQuery,
  BookingQuery,
  InvoiceQuery,
  ReviewQuery,
  UserQuery,
} from './types';

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  navCounts: () => [...adminKeys.all, 'nav-counts'] as const,
  agencies: () => [...adminKeys.all, 'agencies'] as const,
  agencyList: (query: AgencyQuery) => [...adminKeys.agencies(), 'list', query] as const,
  agency: (id: string) => [...adminKeys.agencies(), 'detail', id] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (query: UserQuery) => [...adminKeys.users(), 'list', query] as const,
  user: (id: string) => [...adminKeys.users(), 'detail', id] as const,
  bookings: (query: BookingQuery) => [...adminKeys.all, 'bookings', query] as const,
  invoices: (query: InvoiceQuery) => [...adminKeys.all, 'invoices', query] as const,
  invoice: (id: string) => [...adminKeys.all, 'invoice', id] as const,
  reviews: (query: ReviewQuery) => [...adminKeys.all, 'reviews', query] as const,
  audit: (query: AuditQuery) => [...adminKeys.all, 'audit', query] as const,
  settings: () => [...adminKeys.all, 'settings'] as const,
};

/** Une décision touche plusieurs écrans (tableau de bord, compteurs, journal…) : on rafraîchit tout l'espace. */
function invalidateAdmin(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: adminKeys.all });
}

export function useAdminDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard(), queryFn: () => adminApi.getDashboard() });
}

export function useAdminNavCounts() {
  return useQuery({
    queryKey: adminKeys.navCounts(),
    queryFn: () => adminApi.getNavCounts(),
    refetchInterval: 60_000,
  });
}

export function useAgencies(query: AgencyQuery) {
  return useQuery({
    queryKey: adminKeys.agencyList(query),
    queryFn: () => adminApi.listAgencies(query),
    placeholderData: keepPreviousData,
  });
}

export function useAgency(id: string | null) {
  return useQuery({
    queryKey: adminKeys.agency(id ?? ''),
    queryFn: () => adminApi.getAgency(id ?? ''),
    enabled: id !== null,
  });
}

export function useAgencyDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AgencyDecisionInput }) =>
      adminApi.decideAgency(id, input),
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useUsers(query: UserQuery) {
  return useQuery({
    queryKey: adminKeys.userList(query),
    queryFn: () => adminApi.listUsers(query),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: adminKeys.user(id ?? ''),
    queryFn: () => adminApi.getUser(id ?? ''),
    enabled: id !== null,
  });
}

export function useUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserStatusInput }) =>
      adminApi.setUserStatus(id, input),
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function usePlatformBookings(query: BookingQuery) {
  return useQuery({
    queryKey: adminKeys.bookings(query),
    queryFn: () => adminApi.listBookings(query),
    placeholderData: keepPreviousData,
  });
}

export function useInvoices(query: InvoiceQuery) {
  return useQuery({
    queryKey: adminKeys.invoices(query),
    queryFn: () => adminApi.listInvoices(query),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: adminKeys.invoice(id ?? ''),
    queryFn: () => adminApi.getInvoice(id ?? ''),
    enabled: id !== null,
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: PaymentMethod }) =>
      adminApi.markInvoicePaid(id, method),
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useInvoiceReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.sendInvoiceReminder(id),
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useModeratedReviews(query: ReviewQuery) {
  return useQuery({
    queryKey: adminKeys.reviews(query),
    queryFn: () => adminApi.listReviews(query),
    placeholderData: keepPreviousData,
  });
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewModerationInput }) =>
      adminApi.moderateReview(id, input),
    onSuccess: () => invalidateAdmin(queryClient),
  });
}

export function useAuditLog(query: AuditQuery) {
  return useQuery({
    queryKey: adminKeys.audit(query),
    queryFn: () => adminApi.listAudit(query),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformSettings() {
  return useQuery({ queryKey: adminKeys.settings(), queryFn: () => adminApi.getSettings() });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformSettings) => adminApi.updateSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(adminKeys.settings(), settings);
      return invalidateAdmin(queryClient);
    },
  });
}

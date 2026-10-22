'use client';

import type {
  AgencyProfileInput,
  BookingTransitionInput,
  DeskBookingInput,
  RecordPaymentInput,
  RentalConditions,
  VehicleInput,
  VehicleMaintenanceInput,
  VehiclePhoto,
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
  ReviewQuery,
  VehicleView,
} from './types';
import { type PhotoDraft, photoOrderToApply, planPhotoChanges } from './vehicle-photos';

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
  reviews: (query: ReviewQuery) => [...agencyKeys.all, 'reviews', query] as const,
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

export function useCreateDeskBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeskBookingInput) => agencyApi.createBooking(input),
    onSuccess: (booking: BookingView) => {
      queryClient.setQueryData(agencyKeys.booking(booking.id), booking);
      return invalidateAgency(queryClient);
    },
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

export interface SaveVehicleVariables {
  id: string | null;
  input: VehicleInput;
  /** Photos telles qu'éditées ; omis pour ne pas y toucher. */
  photos?: PhotoDraft[];
  initialPhotos?: VehiclePhoto[];
  onPhotoProgress?: (done: number, total: number) => void;
}

export interface SaveVehicleResult {
  vehicle: VehicleView;
  /** Opérations photo échouées alors que le véhicule, lui, est enregistré. */
  photoFailures: number;
}

async function syncVehiclePhotos(
  vehicleId: string,
  { photos, initialPhotos = [], onPhotoProgress }: SaveVehicleVariables,
): Promise<number> {
  if (photos === undefined) {
    return 0;
  }
  const plan = planPhotoChanges(initialPhotos, photos);
  const settled = await Promise.allSettled(
    plan.removedIds.map((photoId) => agencyApi.deleteVehiclePhoto(vehicleId, photoId)),
  );
  let failures = settled.filter((result) => result.status === 'rejected').length;

  const uploaded = new Map<string, string>();
  for (const [index, draft] of plan.uploads.entries()) {
    onPhotoProgress?.(index, plan.uploads.length);
    try {
      const photo = await agencyApi.uploadVehiclePhoto(vehicleId, draft.file);
      uploaded.set(draft.key, photo.id);
    } catch {
      failures += 1;
    }
  }
  onPhotoProgress?.(plan.uploads.length, plan.uploads.length);

  const order = failures === 0 ? photoOrderToApply(initialPhotos, photos, uploaded) : null;
  if (order !== null) {
    try {
      await agencyApi.reorderVehiclePhotos(vehicleId, order);
    } catch {
      failures += 1;
    }
  }
  return failures;
}

/** Enregistre le véhicule puis synchronise ses photos (suppressions, envois, ordre). */
export function useSaveVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: SaveVehicleVariables): Promise<SaveVehicleResult> => {
      const { id, input } = variables;
      const vehicle =
        id === null
          ? await agencyApi.createVehicle(input)
          : await agencyApi.updateVehicle(id, input);
      const photoFailures = await syncVehiclePhotos(vehicle.id, variables);
      return { vehicle, photoFailures };
    },
    onSettled: () => invalidateAgency(queryClient),
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

export function useAddMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: VehicleMaintenanceInput }) =>
      agencyApi.addMaintenance(vehicleId, input),
    onSuccess: () => invalidateAgency(queryClient),
  });
}

export function useRemoveMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, maintenanceId }: { vehicleId: string; maintenanceId: string }) =>
      agencyApi.removeMaintenance(vehicleId, maintenanceId),
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

export function useReviews(query: ReviewQuery) {
  return useQuery({
    queryKey: agencyKeys.reviews(query),
    queryFn: () => agencyApi.listReviews(query),
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

export function useUploadLogo() {
  return useSettingsMutation((file: File) => agencyApi.uploadLogo(file));
}

export function useRemoveLogo() {
  return useSettingsMutation<undefined>(() => agencyApi.removeLogo());
}

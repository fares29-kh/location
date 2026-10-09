'use client';

import type {
  AgencyDecisionInput,
  DelegationInput,
  DelegationUpdate,
  GovernorateInput,
  GovernorateUpdate,
  MunicipalityInput,
  MunicipalityUpdate,
  PaymentMethod,
  PlatformSettings,
  ReviewModerationInput,
  UserStatusInput,
  VehicleBrandInput,
  VehicleCategoryInput,
  VehicleCategoryUpdate,
  VehicleModelInput,
  VehicleModelUpdate,
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
  vehicleCategories: () => [...adminKeys.all, 'vehicle-categories'] as const,
  vehicleBrands: () => [...adminKeys.all, 'vehicle-brands'] as const,
  vehicleModels: (brandId: string) => [...adminKeys.all, 'vehicle-models', brandId] as const,
  governorates: () => [...adminKeys.all, 'governorates'] as const,
  delegations: (governorateCode: string) =>
    [...adminKeys.all, 'delegations', governorateCode] as const,
  municipalities: (delegationId: string) =>
    [...adminKeys.all, 'municipalities', delegationId] as const,
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
    onSettled: () => invalidateAdmin(queryClient),
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
    onSettled: () => invalidateAdmin(queryClient),
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
    onSettled: () => invalidateAdmin(queryClient),
  });
}

export function useInvoiceReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.sendInvoiceReminder(id),
    onSettled: () => invalidateAdmin(queryClient),
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
    onSettled: () => invalidateAdmin(queryClient),
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

/** Modification d'un référentiel : les compteurs et le journal d'audit changent aussi. */
function useReferentialMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => invalidateAdmin(queryClient) });
}

export function useAdminVehicleCategories() {
  return useQuery({
    queryKey: adminKeys.vehicleCategories(),
    queryFn: () => adminApi.listVehicleCategories(),
  });
}

export function useCreateVehicleCategory() {
  return useReferentialMutation((input: VehicleCategoryInput) =>
    adminApi.createVehicleCategory(input),
  );
}

export function useUpdateVehicleCategory() {
  return useReferentialMutation(({ id, input }: { id: string; input: VehicleCategoryUpdate }) =>
    adminApi.updateVehicleCategory(id, input),
  );
}

export function useDeleteVehicleCategory() {
  return useReferentialMutation((id: string) => adminApi.deleteVehicleCategory(id));
}

export function useAdminVehicleBrands() {
  return useQuery({
    queryKey: adminKeys.vehicleBrands(),
    queryFn: () => adminApi.listVehicleBrands(),
  });
}

export function useCreateVehicleBrand() {
  return useReferentialMutation((input: VehicleBrandInput) => adminApi.createVehicleBrand(input));
}

export function useUpdateVehicleBrand() {
  return useReferentialMutation(({ id, input }: { id: string; input: VehicleBrandInput }) =>
    adminApi.updateVehicleBrand(id, input),
  );
}

export function useDeleteVehicleBrand() {
  return useReferentialMutation((id: string) => adminApi.deleteVehicleBrand(id));
}

export function useAdminVehicleModels(brandId: string | null) {
  return useQuery({
    queryKey: adminKeys.vehicleModels(brandId ?? ''),
    queryFn: () => adminApi.listVehicleModels(brandId ?? ''),
    enabled: brandId !== null,
  });
}

export function useCreateVehicleModel() {
  return useReferentialMutation((input: VehicleModelInput) => adminApi.createVehicleModel(input));
}

export function useUpdateVehicleModel() {
  return useReferentialMutation(({ id, input }: { id: string; input: VehicleModelUpdate }) =>
    adminApi.updateVehicleModel(id, input),
  );
}

export function useDeleteVehicleModel() {
  return useReferentialMutation((id: string) => adminApi.deleteVehicleModel(id));
}

export function useAdminGovernorates() {
  return useQuery({
    queryKey: adminKeys.governorates(),
    queryFn: () => adminApi.listGovernorates(),
  });
}

export function useCreateGovernorate() {
  return useReferentialMutation((input: GovernorateInput) => adminApi.createGovernorate(input));
}

export function useUpdateGovernorate() {
  return useReferentialMutation(({ code, input }: { code: string; input: GovernorateUpdate }) =>
    adminApi.updateGovernorate(code, input),
  );
}

export function useDeleteGovernorate() {
  return useReferentialMutation((code: string) => adminApi.deleteGovernorate(code));
}

export function useAdminDelegations(governorateCode: string | null) {
  return useQuery({
    queryKey: adminKeys.delegations(governorateCode ?? ''),
    queryFn: () => adminApi.listDelegations(governorateCode ?? ''),
    enabled: governorateCode !== null,
  });
}

export function useCreateDelegation() {
  return useReferentialMutation((input: DelegationInput) => adminApi.createDelegation(input));
}

export function useUpdateDelegation() {
  return useReferentialMutation(({ id, input }: { id: string; input: DelegationUpdate }) =>
    adminApi.updateDelegation(id, input),
  );
}

export function useDeleteDelegation() {
  return useReferentialMutation((id: string) => adminApi.deleteDelegation(id));
}

export function useAdminMunicipalities(delegationId: string | null) {
  return useQuery({
    queryKey: adminKeys.municipalities(delegationId ?? ''),
    queryFn: () => adminApi.listMunicipalities(delegationId ?? ''),
    enabled: delegationId !== null,
  });
}

export function useCreateMunicipality() {
  return useReferentialMutation((input: MunicipalityInput) => adminApi.createMunicipality(input));
}

export function useUpdateMunicipality() {
  return useReferentialMutation(({ id, input }: { id: string; input: MunicipalityUpdate }) =>
    adminApi.updateMunicipality(id, input),
  );
}

export function useDeleteMunicipality() {
  return useReferentialMutation((id: string) => adminApi.deleteMunicipality(id));
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

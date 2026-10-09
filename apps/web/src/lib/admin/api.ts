import type {
  AdminDelegation,
  AdminGovernorate,
  AdminMunicipality,
  AdminVehicleBrand,
  AdminVehicleCategory,
  AdminVehicleModel,
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
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

import type {
  AdminDashboard,
  AdminNavCounts,
  Agency,
  AgencyDetail,
  AgencyList,
  AgencyQuery,
  AuditEntry,
  AuditQuery,
  BookingList,
  BookingQuery,
  Invoice,
  InvoiceList,
  InvoiceQuery,
  ModeratedReview,
  Paginated,
  PlatformUser,
  ReviewList,
  ReviewQuery,
  UserDetail,
  UserList,
  UserQuery,
} from './types';

/**
 * Contrat de l'API du portail d'administration. Les écrans ne dépendent que de cette interface,
 * implémentée par les routes `/api/v1/admin/*`.
 */
export interface AdminApi {
  getDashboard(): Promise<AdminDashboard>;
  getNavCounts(): Promise<AdminNavCounts>;

  listAgencies(query: AgencyQuery): Promise<AgencyList>;
  getAgency(id: string): Promise<AgencyDetail>;
  decideAgency(id: string, input: AgencyDecisionInput): Promise<Agency>;

  listUsers(query: UserQuery): Promise<UserList>;
  getUser(id: string): Promise<UserDetail>;
  setUserStatus(id: string, input: UserStatusInput): Promise<PlatformUser>;

  listBookings(query: BookingQuery): Promise<BookingList>;

  listInvoices(query: InvoiceQuery): Promise<InvoiceList>;
  getInvoice(id: string): Promise<Invoice>;
  markInvoicePaid(id: string, method: PaymentMethod): Promise<Invoice>;
  sendInvoiceReminder(id: string): Promise<Invoice>;

  listReviews(query: ReviewQuery): Promise<ReviewList>;
  moderateReview(id: string, input: ReviewModerationInput): Promise<ModeratedReview>;

  listAudit(query: AuditQuery): Promise<Paginated<AuditEntry>>;

  getSettings(): Promise<PlatformSettings>;
  updateSettings(input: PlatformSettings): Promise<PlatformSettings>;

  listVehicleCategories(): Promise<AdminVehicleCategory[]>;
  createVehicleCategory(input: VehicleCategoryInput): Promise<AdminVehicleCategory>;
  updateVehicleCategory(id: string, input: VehicleCategoryUpdate): Promise<AdminVehicleCategory>;
  deleteVehicleCategory(id: string): Promise<void>;

  listVehicleBrands(): Promise<AdminVehicleBrand[]>;
  createVehicleBrand(input: VehicleBrandInput): Promise<AdminVehicleBrand>;
  updateVehicleBrand(id: string, input: VehicleBrandInput): Promise<AdminVehicleBrand>;
  deleteVehicleBrand(id: string): Promise<void>;

  listVehicleModels(brandId: string): Promise<AdminVehicleModel[]>;
  createVehicleModel(input: VehicleModelInput): Promise<AdminVehicleModel>;
  updateVehicleModel(id: string, input: VehicleModelUpdate): Promise<AdminVehicleModel>;
  deleteVehicleModel(id: string): Promise<void>;

  listGovernorates(): Promise<AdminGovernorate[]>;
  createGovernorate(input: GovernorateInput): Promise<AdminGovernorate>;
  updateGovernorate(code: string, input: GovernorateUpdate): Promise<AdminGovernorate>;
  deleteGovernorate(code: string): Promise<void>;

  listDelegations(governorateCode: string): Promise<AdminDelegation[]>;
  createDelegation(input: DelegationInput): Promise<AdminDelegation>;
  updateDelegation(id: string, input: DelegationUpdate): Promise<AdminDelegation>;
  deleteDelegation(id: string): Promise<void>;

  listMunicipalities(delegationId: string): Promise<AdminMunicipality[]>;
  createMunicipality(input: MunicipalityInput): Promise<AdminMunicipality>;
  updateMunicipality(id: string, input: MunicipalityUpdate): Promise<AdminMunicipality>;
  deleteMunicipality(id: string): Promise<void>;
}

/** Réponse typée par le contrat partagé `@drivetn/types` (l'API valide ses propres entrées). */
function shape<T>() {
  return z.custom<T>(() => true);
}

function withQuery(path: string, params: Record<string, string | number>): string {
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return `${path}?${search.toString()}`;
}

const segment = encodeURIComponent;

function post<T>(path: string, body?: unknown) {
  return apiFetch(path, { method: 'POST', body, schema: shape<T>() });
}

function put<T>(path: string, body: unknown) {
  return apiFetch(path, { method: 'PUT', body, schema: shape<T>() });
}

function remove(path: string) {
  return apiFetch(path, { method: 'DELETE' });
}

function createHttpAdminApi(): AdminApi {
  return {
    getDashboard: () => apiFetch('/admin/dashboard', { schema: shape<AdminDashboard>() }),
    getNavCounts: () => apiFetch('/admin/nav-counts', { schema: shape<AdminNavCounts>() }),

    listAgencies: (query) =>
      apiFetch(withQuery('/admin/agencies', { ...query }), { schema: shape<AgencyList>() }),
    getAgency: (id) =>
      apiFetch(`/admin/agencies/${segment(id)}`, { schema: shape<AgencyDetail>() }),
    decideAgency: (id, input) => post<Agency>(`/admin/agencies/${segment(id)}/decision`, input),

    listUsers: (query) =>
      apiFetch(withQuery('/admin/users', { ...query }), { schema: shape<UserList>() }),
    getUser: (id) => apiFetch(`/admin/users/${segment(id)}`, { schema: shape<UserDetail>() }),
    setUserStatus: (id, input) => post<PlatformUser>(`/admin/users/${segment(id)}/status`, input),

    listBookings: (query) =>
      apiFetch(withQuery('/admin/bookings', { ...query }), { schema: shape<BookingList>() }),

    listInvoices: (query) =>
      apiFetch(withQuery('/admin/invoices', { ...query }), { schema: shape<InvoiceList>() }),
    getInvoice: (id) => apiFetch(`/admin/invoices/${segment(id)}`, { schema: shape<Invoice>() }),
    markInvoicePaid: (id, method) =>
      post<Invoice>(`/admin/invoices/${segment(id)}/payment`, { method }),
    sendInvoiceReminder: (id) => post<Invoice>(`/admin/invoices/${segment(id)}/reminder`),

    listReviews: (query) =>
      apiFetch(withQuery('/admin/reviews', { ...query }), { schema: shape<ReviewList>() }),
    moderateReview: (id, input) =>
      post<ModeratedReview>(`/admin/reviews/${segment(id)}/moderation`, input),

    listAudit: (query) =>
      apiFetch(withQuery('/admin/audit', { ...query }), {
        schema: shape<Paginated<AuditEntry>>(),
      }),

    getSettings: () => apiFetch('/admin/settings', { schema: shape<PlatformSettings>() }),
    updateSettings: (input) =>
      apiFetch('/admin/settings', {
        method: 'PUT',
        body: input,
        schema: shape<PlatformSettings>(),
      }),

    listVehicleCategories: () =>
      apiFetch('/admin/vehicle-categories', { schema: shape<AdminVehicleCategory[]>() }),
    createVehicleCategory: (input) =>
      post<AdminVehicleCategory>('/admin/vehicle-categories', input),
    updateVehicleCategory: (id, input) =>
      put<AdminVehicleCategory>(`/admin/vehicle-categories/${segment(id)}`, input),
    deleteVehicleCategory: (id) => remove(`/admin/vehicle-categories/${segment(id)}`),

    listVehicleBrands: () =>
      apiFetch('/admin/vehicle-brands', { schema: shape<AdminVehicleBrand[]>() }),
    createVehicleBrand: (input) => post<AdminVehicleBrand>('/admin/vehicle-brands', input),
    updateVehicleBrand: (id, input) =>
      put<AdminVehicleBrand>(`/admin/vehicle-brands/${segment(id)}`, input),
    deleteVehicleBrand: (id) => remove(`/admin/vehicle-brands/${segment(id)}`),

    listVehicleModels: (brandId) =>
      apiFetch(withQuery('/admin/vehicle-models', { brand: brandId }), {
        schema: shape<AdminVehicleModel[]>(),
      }),
    createVehicleModel: (input) => post<AdminVehicleModel>('/admin/vehicle-models', input),
    updateVehicleModel: (id, input) =>
      put<AdminVehicleModel>(`/admin/vehicle-models/${segment(id)}`, input),
    deleteVehicleModel: (id) => remove(`/admin/vehicle-models/${segment(id)}`),

    listGovernorates: () =>
      apiFetch('/admin/governorates', { schema: shape<AdminGovernorate[]>() }),
    createGovernorate: (input) => post<AdminGovernorate>('/admin/governorates', input),
    updateGovernorate: (code, input) =>
      put<AdminGovernorate>(`/admin/governorates/${segment(code)}`, input),
    deleteGovernorate: (code) => remove(`/admin/governorates/${segment(code)}`),

    listDelegations: (governorate) =>
      apiFetch(withQuery('/admin/delegations', { governorate }), {
        schema: shape<AdminDelegation[]>(),
      }),
    createDelegation: (input) => post<AdminDelegation>('/admin/delegations', input),
    updateDelegation: (id, input) =>
      put<AdminDelegation>(`/admin/delegations/${segment(id)}`, input),
    deleteDelegation: (id) => remove(`/admin/delegations/${segment(id)}`),

    listMunicipalities: (delegation) =>
      apiFetch(withQuery('/admin/municipalities', { delegation }), {
        schema: shape<AdminMunicipality[]>(),
      }),
    createMunicipality: (input) => post<AdminMunicipality>('/admin/municipalities', input),
    updateMunicipality: (id, input) =>
      put<AdminMunicipality>(`/admin/municipalities/${segment(id)}`, input),
    deleteMunicipality: (id) => remove(`/admin/municipalities/${segment(id)}`),
  };
}

export const adminApi: AdminApi = createHttpAdminApi();

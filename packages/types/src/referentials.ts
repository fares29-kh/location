import { z } from 'zod';

import { type LocalizedText, localizedTextSchema } from './location';
import { slugSchema, VEHICLE_BRAND_MAX, VEHICLE_MODEL_MAX } from './vehicle';

/**
 * Référentiels gérés par l'administration : catégories et marques de véhicules, gouvernorats,
 * délégations et municipalités.
 */

// --- Lecture publique -----------------------------------------------------------------

export const vehicleCategoryInfoSchema = z.object({
  id: z.string(),
  /** Identifiant stable des URL de recherche (ex. « suv »). */
  slug: z.string().min(1),
  name: localizedTextSchema,
  /** Textes vides si la catégorie n'a pas de description. */
  description: z.object({ fr: z.string(), ar: z.string(), en: z.string() }),
  /** Ordre d'affichage croissant. */
  position: z.number().int(),
});
export type VehicleCategoryInfo = z.infer<typeof vehicleCategoryInfoSchema>;

export const vehicleBrandInfoSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** Modèles de la marque, triés par nom. */
  models: z.array(z.string().min(1)),
});
export type VehicleBrandInfo = z.infer<typeof vehicleBrandInfoSchema>;

// --- Vues de l'administration ----------------------------------------------------------------

export interface AdminVehicleCategory extends VehicleCategoryInfo {
  vehiclesCount: number;
}

export interface AdminVehicleBrand {
  id: string;
  name: string;
  modelsCount: number;
  vehiclesCount: number;
}

export interface AdminVehicleModel {
  id: string;
  brandId: string;
  name: string;
  vehiclesCount: number;
}

export interface AdminGovernorate {
  code: string;
  slug: string;
  name: LocalizedText;
  delegationsCount: number;
  agenciesCount: number;
  locationsCount: number;
}

export interface AdminDelegation {
  id: string;
  governorateCode: string;
  name: LocalizedText;
  municipalitiesCount: number;
}

export interface AdminMunicipality {
  id: string;
  delegationId: string;
  name: LocalizedText;
}

// --- Saisies de l'administration ------------------------------------------------------------

export const REFERENTIAL_NAME_MAX = 80;
export const CATEGORY_DESCRIPTION_MAX = 200;
export const CATEGORY_POSITION_MAX = 999;

const nameField = z
  .string()
  .trim()
  .min(1, { message: 'REQUIRED' })
  .max(REFERENTIAL_NAME_MAX, { message: 'TOO_LONG' });

export const localizedNameInputSchema = z.object({ fr: nameField, ar: nameField, en: nameField });

const descriptionField = z.string().trim().max(CATEGORY_DESCRIPTION_MAX, { message: 'TOO_LONG' });

export const governorateCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}$/, { message: 'INVALID_CODE' });

export const vehicleCategoryUpdateSchema = z.object({
  name: localizedNameInputSchema,
  description: z.object({ fr: descriptionField, ar: descriptionField, en: descriptionField }),
  position: z
    .number()
    .int()
    .min(0, { message: 'OUT_OF_RANGE' })
    .max(CATEGORY_POSITION_MAX, { message: 'OUT_OF_RANGE' }),
});
export type VehicleCategoryUpdate = z.infer<typeof vehicleCategoryUpdateSchema>;

/** Le slug est fixé à la création : il figure dans les liens de recherche déjà partagés. */
export const vehicleCategoryInputSchema = vehicleCategoryUpdateSchema.extend({ slug: slugSchema });
export type VehicleCategoryInput = z.infer<typeof vehicleCategoryInputSchema>;

export const vehicleBrandInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .max(VEHICLE_BRAND_MAX, { message: 'TOO_LONG' }),
});
export type VehicleBrandInput = z.infer<typeof vehicleBrandInputSchema>;

export const vehicleModelUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .max(VEHICLE_MODEL_MAX, { message: 'TOO_LONG' }),
});
export type VehicleModelUpdate = z.infer<typeof vehicleModelUpdateSchema>;

export const vehicleModelInputSchema = vehicleModelUpdateSchema.extend({
  brandId: z.string().trim().min(1, { message: 'REQUIRED' }),
});
export type VehicleModelInput = z.infer<typeof vehicleModelInputSchema>;

export const vehicleModelQuerySchema = z.object({ brand: z.string().trim().min(1) });
export type VehicleModelQuery = z.infer<typeof vehicleModelQuerySchema>;

export const governorateUpdateSchema = z.object({
  slug: slugSchema,
  name: localizedNameInputSchema,
});
export type GovernorateUpdate = z.infer<typeof governorateUpdateSchema>;

/** Le code officiel est la clé du gouvernorat : il n'est plus modifiable après la création. */
export const governorateInputSchema = governorateUpdateSchema.extend({
  code: governorateCodeSchema,
});
export type GovernorateInput = z.infer<typeof governorateInputSchema>;

export const delegationUpdateSchema = z.object({ name: localizedNameInputSchema });
export type DelegationUpdate = z.infer<typeof delegationUpdateSchema>;

export const delegationInputSchema = delegationUpdateSchema.extend({
  governorateCode: governorateCodeSchema,
});
export type DelegationInput = z.infer<typeof delegationInputSchema>;

export const municipalityUpdateSchema = z.object({ name: localizedNameInputSchema });
export type MunicipalityUpdate = z.infer<typeof municipalityUpdateSchema>;

export const municipalityInputSchema = municipalityUpdateSchema.extend({
  delegationId: z.string().trim().min(1, { message: 'REQUIRED' }),
});
export type MunicipalityInput = z.infer<typeof municipalityInputSchema>;

export const delegationQuerySchema = z.object({ governorate: governorateCodeSchema });
export type DelegationQuery = z.infer<typeof delegationQuerySchema>;

export const municipalityQuerySchema = z.object({ delegation: z.string().trim().min(1) });
export type MunicipalityQuery = z.infer<typeof municipalityQuerySchema>;

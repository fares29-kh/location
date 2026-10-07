import { z } from 'zod';

import type { Locale } from './locale';

/** Texte traduit dans les trois langues de la plateforme. */
export const localizedTextSchema = z.object({
  fr: z.string().min(1),
  ar: z.string().min(1),
  en: z.string().min(1),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export function pickLocalized(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export const LOCATION_TYPES = ['AIRPORT', 'CITY', 'TRAIN_STATION', 'PORT'] as const;
export const locationTypeSchema = z.enum(LOCATION_TYPES);
export type LocationType = z.infer<typeof locationTypeSchema>;

export const governorateSchema = z.object({
  /** Code officiel à 2 chiffres (ex. « 11 » pour Tunis). */
  code: z.string().regex(/^\d{2}$/),
  slug: z.string().min(1),
  name: localizedTextSchema,
});
export type Governorate = z.infer<typeof governorateSchema>;

export const locationSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  type: locationTypeSchema,
  governorateCode: z.string(),
  iataCode: z.string().length(3).nullable(),
  name: localizedTextSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type PickupLocation = z.infer<typeof locationSchema>;

export const locationQuerySchema = z.object({
  type: locationTypeSchema.optional(),
  governorate: z
    .string()
    .regex(/^\d{2}$/)
    .optional(),
});
export type LocationQuery = z.infer<typeof locationQuerySchema>;

import { z } from 'zod';

import { optionalEmailSchema } from './auth';
import { paymentMethodSchema } from './booking';
import { tunisianPhoneSchema } from './phone';

/** Fiche publique de l'agence, affichée aux clients sur le portail. */
export const agencyProfileSchema = z.object({
  name: z.string().trim().min(1, { message: 'REQUIRED' }).max(80, { message: 'TOO_LONG' }),
  phone: tunisianPhoneSchema,
  whatsappPhone: tunisianPhoneSchema,
  email: optionalEmailSchema,
  address: z.string().trim().min(1, { message: 'REQUIRED' }).max(200, { message: 'TOO_LONG' }),
  governorateCode: z.string().regex(/^\d{2}$/, { message: 'REQUIRED' }),
  description: z.string().trim().max(600, { message: 'TOO_LONG' }),
});

export type AgencyProfileInput = z.input<typeof agencyProfileSchema>;
export type AgencyProfile = z.output<typeof agencyProfileSchema>;

/** Logo de l'agence : JPG, PNG ou WebP (mêmes formats que les photos de véhicules). */
export const AGENCY_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export const DRIVER_AGE_MIN = 18;
export const DRIVER_AGE_MAX = 30;
export const LICENSE_YEARS_MAX = 10;
export const CANCELLATION_HOURS_MAX = 168;

/** Conditions de location appliquées à toutes les réservations de l'agence. */
export const rentalConditionsSchema = z.object({
  minDriverAge: z
    .number()
    .int()
    .min(DRIVER_AGE_MIN, { message: 'OUT_OF_RANGE' })
    .max(DRIVER_AGE_MAX, { message: 'OUT_OF_RANGE' }),
  minLicenseYears: z
    .number()
    .int()
    .min(0, { message: 'OUT_OF_RANGE' })
    .max(LICENSE_YEARS_MAX, { message: 'OUT_OF_RANGE' }),
  /** Délai minimal (en heures) pour qu'un client annule sans frais. */
  freeCancellationHours: z
    .number()
    .int()
    .min(0, { message: 'OUT_OF_RANGE' })
    .max(CANCELLATION_HOURS_MAX, { message: 'OUT_OF_RANGE' }),
  /** Confirmation automatique des demandes, sans validation manuelle. */
  instantConfirmation: z.boolean(),
  acceptedPaymentMethods: z
    .array(paymentMethodSchema)
    .min(1, { message: 'PAYMENT_METHOD_REQUIRED' }),
});

export type RentalConditions = z.infer<typeof rentalConditionsSchema>;

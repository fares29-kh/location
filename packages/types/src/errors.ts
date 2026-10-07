import { z } from 'zod';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
  // Codes métier de l'authentification, traduits par le front.
  'INVALID_CREDENTIALS',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'PHONE_ALREADY_USED',
  'EMAIL_ALREADY_USED',
  'PHONE_NOT_VERIFIED',
  'ACCOUNT_SUSPENDED',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Format normalisé de toutes les erreurs renvoyées par l'API. */
export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

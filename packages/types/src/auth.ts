import { z } from 'zod';

import { localeSchema } from './locale';
import { isValidTunisianPhone, normalizeTunisianPhone, tunisianPhoneSchema } from './phone';
import { type Portal, portalSchema } from './portal';

export const USER_ROLES = ['CUSTOMER', 'AGENCY_OWNER', 'AGENCY_STAFF', 'ADMIN'] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Sous-rôles de l'équipe plateforme. */
export const ADMIN_ROLES = ['SUPER_ADMIN', 'SUPPORT', 'FINANCE'] as const;
export const adminRoleSchema = z.enum(ADMIN_ROLES);
export type AdminRole = z.infer<typeof adminRoleSchema>;

/** `PENDING_VERIFICATION` : compte créé, téléphone pas encore vérifié par OTP. */
export const USER_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'] as const;
export const userStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const OTP_PURPOSES = ['SIGNUP', 'LOGIN', 'PASSWORD_RESET'] as const;
export const otpPurposeSchema = z.enum(OTP_PURPOSES);
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;

export const OTP_CHANNELS = ['SMS', 'WHATSAPP'] as const;
export const otpChannelSchema = z.enum(OTP_CHANNELS);
export type OtpChannel = z.infer<typeof otpChannelSchema>;

export const OTP_LENGTH = 6;

/** Cookie httpOnly de l'access token (JWT court). */
export const ACCESS_TOKEN_COOKIE = 'drivetn_at';
/**
 * Cookie httpOnly du refresh token opaque. Chemin `/` : le middleware Next.js doit le voir
 * sur les pages pour renouveler une session expirée avant le rendu serveur.
 */
export const REFRESH_TOKEN_COOKIE = 'drivetn_rt';

const ROLE_PORTALS: Record<UserRole, Portal> = {
  CUSTOMER: 'client',
  AGENCY_OWNER: 'agency',
  AGENCY_STAFF: 'agency',
  ADMIN: 'admin',
};

/** Portail sur lequel un rôle travaille (redirection après connexion). */
export function portalForRole(role: UserRole): Portal {
  return ROLE_PORTALS[role];
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: 'PASSWORD_TOO_SHORT' })
  .max(PASSWORD_MAX_LENGTH, { message: 'PASSWORD_TOO_LONG' })
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), {
    message: 'PASSWORD_TOO_WEAK',
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { message: 'INVALID_EMAIL' })
  .pipe(z.email({ message: 'INVALID_EMAIL' }));

/** Email facultatif dans un formulaire : une chaîne vide vaut « non renseigné ». */
export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const personNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'REQUIRED' })
  .max(60, { message: 'TOO_LONG' });

export type Identifier = { type: 'email'; value: string } | { type: 'phone'; value: string };

/** Identifiant de connexion : email (contient « @ ») ou téléphone tunisien. */
export const identifierSchema = z
  .string()
  .trim()
  .min(1, { message: 'REQUIRED' })
  .refine(
    (value) =>
      value.includes('@') ? emailSchema.safeParse(value).success : isValidTunisianPhone(value),
    { message: 'INVALID_IDENTIFIER' },
  )
  .transform((value): Identifier =>
    value.includes('@')
      ? { type: 'email', value: value.toLowerCase() }
      : { type: 'phone', value: normalizeTunisianPhone(value) },
  );

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), { message: 'INVALID_OTP_FORMAT' });

export const signupSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: tunisianPhoneSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
  locale: localeSchema.optional(),
  channel: otpChannelSchema.default('SMS'),
});
export type SignupInput = z.input<typeof signupSchema>;
export type SignupRequest = z.output<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, { message: 'REQUIRED' }).max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginRequest = z.output<typeof loginSchema>;

/** Demande (ou renvoi) d'un code : vérification d'inscription ou connexion sans mot de passe. */
export const otpRequestSchema = z.object({
  phone: tunisianPhoneSchema,
  purpose: z.enum(['SIGNUP', 'LOGIN']),
  channel: otpChannelSchema.default('SMS'),
});
export type OtpRequestInput = z.input<typeof otpRequestSchema>;
export type OtpRequest = z.output<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: tunisianPhoneSchema,
  code: otpCodeSchema,
});
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
export type OtpVerifyRequest = z.output<typeof otpVerifySchema>;

export const forgotPasswordSchema = z.object({
  phone: tunisianPhoneSchema,
  channel: otpChannelSchema.default('SMS'),
});
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordRequest = z.output<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  phone: tunisianPhoneSchema,
  code: otpCodeSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordRequest = z.output<typeof resetPasswordSchema>;

export const handoffSchema = z.object({
  code: z.string().min(16).max(128),
});
export type HandoffRequest = z.output<typeof handoffSchema>;

export const updateProfileSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.union([z.literal(''), emailSchema]).transform((value) => (value === '' ? null : value)),
  locale: localeSchema,
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileRequest = z.output<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'REQUIRED' }).max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordRequest = z.output<typeof changePasswordSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  role: userRoleSchema,
  adminRole: adminRoleSchema.nullable(),
  status: userStatusSchema,
  firstName: z.string(),
  lastName: z.string(),
  /** Numéro national à 8 chiffres. */
  phone: z.string(),
  phoneVerified: z.boolean(),
  email: z.string().nullable(),
  locale: localeSchema,
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

/** Délais renvoyés après l'envoi d'un code. */
export const otpDispatchSchema = z.object({
  phone: z.string(),
  expiresInSeconds: z.number().int().positive(),
  resendInSeconds: z.number().int().nonnegative(),
});
export type OtpDispatch = z.infer<typeof otpDispatchSchema>;

/**
 * Résultat d'une connexion : session ouverte sur le portail courant, ou redirection
 * vers le portail du rôle via un code de transfert à usage unique.
 */
export const authResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('authenticated'), user: currentUserSchema }),
  z.object({
    status: z.literal('redirect'),
    portal: portalSchema,
    redirectUrl: z.string(),
  }),
]);
export type AuthResult = z.infer<typeof authResultSchema>;

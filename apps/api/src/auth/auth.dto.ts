import {
  ADMIN_ROLES,
  type AdminRole,
  type CurrentUser,
  type Locale,
  LOCALES,
  OTP_CHANNELS,
  type OtpChannel,
  type OtpDispatch,
  type Portal,
  PORTALS,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from '@drivetn/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Classes de documentation OpenAPI : la validation réelle est faite par les schémas Zod partagés.

const PHONE_EXAMPLE = '+216 98 123 456';

export class SignupDto {
  @ApiProperty({ example: 'Amira' })
  firstName: string;

  @ApiProperty({ example: 'Ben Salah' })
  lastName: string;

  @ApiProperty({ example: PHONE_EXAMPLE, description: 'Numéro tunisien (+216, 8 chiffres)' })
  phone: string;

  @ApiPropertyOptional({ example: 'amira@example.tn' })
  email?: string;

  @ApiProperty({ minLength: 8, description: 'Au moins une lettre et un chiffre' })
  password: string;

  @ApiPropertyOptional({ enum: LOCALES })
  locale?: Locale;

  @ApiPropertyOptional({ enum: OTP_CHANNELS, default: 'SMS' })
  channel?: OtpChannel;
}

export class LoginDto {
  @ApiProperty({ example: 'customer@demo.tn', description: 'Téléphone ou email' })
  identifier: string;

  @ApiProperty()
  password: string;
}

export class OtpRequestDto {
  @ApiProperty({ example: PHONE_EXAMPLE })
  phone: string;

  @ApiProperty({ enum: ['SIGNUP', 'LOGIN'] })
  purpose: 'SIGNUP' | 'LOGIN';

  @ApiPropertyOptional({ enum: OTP_CHANNELS, default: 'SMS' })
  channel?: OtpChannel;
}

export class OtpVerifyDto {
  @ApiProperty({ example: PHONE_EXAMPLE })
  phone: string;

  @ApiProperty({ example: '123456' })
  code: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: PHONE_EXAMPLE })
  phone: string;

  @ApiPropertyOptional({ enum: OTP_CHANNELS, default: 'SMS' })
  channel?: OtpChannel;
}

export class ResetPasswordDto extends OtpVerifyDto {
  @ApiProperty({ minLength: 8 })
  password: string;
}

export class HandoffDto {
  @ApiProperty({ description: 'Code de transfert à usage unique (60 s)' })
  code: string;
}

export class UpdateProfileDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ description: 'Chaîne vide pour retirer l’email' })
  email: string;

  @ApiProperty({ enum: LOCALES })
  locale: Locale;
}

export class ChangePasswordDto {
  @ApiProperty()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  newPassword: string;
}

export class CurrentUserDto implements CurrentUser {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: USER_ROLES })
  role: UserRole;

  @ApiProperty({ enum: ADMIN_ROLES, nullable: true, type: String })
  adminRole: AdminRole | null;

  @ApiProperty({ enum: USER_STATUSES })
  status: UserStatus;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ example: '98123456', description: 'Numéro national à 8 chiffres' })
  phone: string;

  @ApiProperty()
  phoneVerified: boolean;

  @ApiProperty({ nullable: true, type: String })
  email: string | null;

  @ApiProperty({ enum: LOCALES })
  locale: Locale;
}

export class OtpDispatchDto implements OtpDispatch {
  @ApiProperty({ example: '98123456' })
  phone: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds: number;

  @ApiProperty({ example: 60 })
  resendInSeconds: number;
}

export class AuthResultDto {
  @ApiProperty({ enum: ['authenticated', 'redirect'] })
  status: 'authenticated' | 'redirect';

  @ApiPropertyOptional({ type: CurrentUserDto, description: 'Si status = authenticated' })
  user?: CurrentUserDto;

  @ApiPropertyOptional({ enum: PORTALS, description: 'Si status = redirect' })
  portal?: Portal;

  @ApiPropertyOptional({
    description: 'Si status = redirect : URL de transfert vers le portail du rôle',
  })
  redirectUrl?: string;
}

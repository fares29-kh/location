import { randomBytes } from 'node:crypto';

import {
  type AuthResult,
  buildPortalOrigin,
  type CurrentUser,
  DEFAULT_LOCALE,
  type ForgotPasswordRequest,
  type LoginRequest,
  normalizeTunisianPhone,
  type OtpDispatch,
  type OtpRequest,
  type OtpVerifyRequest,
  type Portal,
  portalForRole,
  type ResetPasswordRequest,
  type SignupRequest,
  toE164,
  type UserRole,
} from '@drivetn/types';
import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { Redis } from 'ioredis';

import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import type { RequestContext } from '../common/http/request-context';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { type SessionTokens, TokenService } from './token.service';
import { toCurrentUser } from './user.mapper';

export const HANDOFF_TTL_SECONDS = 60;
export const HANDOFF_PATH = '/auth/handoff';
/** Tentatives de connexion par identifiant (en plus de la limite par IP du contrôleur). */
export const LOGIN_IDENTIFIER_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

const SIGNUP_ROLES: Partial<Record<Portal, UserRole>> = {
  client: 'CUSTOMER',
  agency: 'AGENCY_OWNER',
};

/** Résultat interne : session à poser en cookies, ou redirection vers un autre portail. */
export type LoginOutcome =
  | { status: 'authenticated'; user: CurrentUser; tokens: SessionTokens }
  | Extract<AuthResult, { status: 'redirect' }>;

function handoffKey(code: string): string {
  return `drivetn:handoff:${code}`;
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const INVALID_CREDENTIALS = 'Identifiant ou mot de passe incorrect.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
    private readonly rateLimit: RateLimitService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  /**
   * Crée (ou remplace, s'il n'a jamais été vérifié) un compte en attente de vérification
   * du téléphone, puis envoie le code OTP d'inscription.
   */
  async signup(input: SignupRequest, context: RequestContext): Promise<OtpDispatch> {
    const role = context.portal === null ? undefined : SIGNUP_ROLES[context.portal];
    if (role === undefined) {
      throw new ForbiddenException("L'inscription n'est pas ouverte sur ce portail.");
    }
    const phone = toE164(input.phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing !== null && existing.status !== 'PENDING_VERIFICATION') {
      throw phoneAlreadyUsed();
    }
    if (input.email !== undefined) {
      const emailOwner = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (emailOwner !== null && emailOwner.id !== existing?.id) {
        throw emailAlreadyUsed();
      }
    }

    const data = {
      role,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      passwordHash: await this.passwords.hash(input.password),
      locale: input.locale ?? DEFAULT_LOCALE,
    };
    let user: User;
    try {
      user =
        existing === null
          ? await this.prisma.user.create({ data: { ...data, phone } })
          : await this.prisma.user.update({ where: { id: existing.id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw String(error.meta?.target).includes('email')
          ? emailAlreadyUsed()
          : phoneAlreadyUsed();
      }
      throw error;
    }

    await this.audit.log({
      action: 'auth.signup',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      metadata: { role },
      ip: context.ip,
    });
    return this.otp.send({
      phone: input.phone,
      purpose: 'SIGNUP',
      channel: input.channel,
      locale: user.locale,
      ip: context.ip,
      deliver: true,
    });
  }

  /** Renvoi du code d'inscription, ou code de connexion sans mot de passe. */
  async requestOtp(input: OtpRequest, context: RequestContext): Promise<OtpDispatch> {
    const user = await this.findByPhone(input.phone);
    const eligible =
      input.purpose === 'SIGNUP'
        ? user?.status === 'PENDING_VERIFICATION'
        : user?.status === 'ACTIVE';
    return this.otp.send({
      phone: input.phone,
      purpose: input.purpose,
      channel: input.channel,
      locale: user?.locale ?? DEFAULT_LOCALE,
      ip: context.ip,
      deliver: eligible,
    });
  }

  async verifySignup(input: OtpVerifyRequest, context: RequestContext): Promise<LoginOutcome> {
    await this.otp.verify(input.phone, 'SIGNUP', input.code);
    const user = await this.findByPhone(input.phone);
    if (user === null) {
      throw new NotFoundException('Compte introuvable.');
    }
    const activated =
      user.status === 'PENDING_VERIFICATION'
        ? await this.prisma.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE', phoneVerifiedAt: new Date() },
          })
        : user;
    await this.audit.log({
      action: 'auth.phone_verified',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      ip: context.ip,
    });
    return this.completeLogin(activated, context, 'otp');
  }

  async loginWithPassword(input: LoginRequest, context: RequestContext): Promise<LoginOutcome> {
    await this.rateLimit.consume(
      `login:${input.identifier.type}:${input.identifier.value}`,
      LOGIN_IDENTIFIER_LIMIT,
    );
    const user =
      input.identifier.type === 'email'
        ? await this.prisma.user.findFirst({
            where: { email: input.identifier.value, deletedAt: null },
          })
        : await this.findByPhone(input.identifier.value);

    const valid =
      user?.passwordHash === null || user?.passwordHash === undefined
        ? await this.passwords.verifyDummy(input.password)
        : await this.passwords.verify(user.passwordHash, input.password);
    if (user === null || !valid) {
      await this.audit.log({
        action: 'auth.login_failed',
        actorId: user?.id ?? null,
        metadata: { identifierType: input.identifier.type },
        ip: context.ip,
      });
      throw new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }
    if (user.status === 'PENDING_VERIFICATION') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'PHONE_NOT_VERIFIED',
        'Vérifiez votre numéro de téléphone pour continuer.',
        { phone: normalizeTunisianPhone(user.phone) },
      );
    }
    return this.completeLogin(user, context, 'password');
  }

  async loginWithOtp(input: OtpVerifyRequest, context: RequestContext): Promise<LoginOutcome> {
    await this.otp.verify(input.phone, 'LOGIN', input.code);
    const user = await this.findByPhone(input.phone);
    if (user === null) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }
    return this.completeLogin(user, context, 'otp');
  }

  async forgotPassword(
    input: ForgotPasswordRequest,
    context: RequestContext,
  ): Promise<OtpDispatch> {
    const user = await this.findByPhone(input.phone);
    return this.otp.send({
      phone: input.phone,
      purpose: 'PASSWORD_RESET',
      channel: input.channel,
      locale: user?.locale ?? DEFAULT_LOCALE,
      ip: context.ip,
      deliver: user !== null && user.status !== 'SUSPENDED',
    });
  }

  /** Nouveau mot de passe après preuve de possession du téléphone ; ferme toutes les sessions. */
  async resetPassword(input: ResetPasswordRequest, context: RequestContext): Promise<void> {
    await this.otp.verify(input.phone, 'PASSWORD_RESET', input.code);
    const user = await this.findByPhone(input.phone);
    if (user === null) {
      throw new NotFoundException('Compte introuvable.');
    }
    const verifiesPhone = user.status === 'PENDING_VERIFICATION';
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwords.hash(input.password),
        ...(verifiesPhone ? { status: 'ACTIVE', phoneVerifiedAt: new Date() } : {}),
      },
    });
    await this.tokens.revokeAllForUser(user.id);
    await this.audit.log({
      action: 'auth.password_reset',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      ip: context.ip,
    });
  }

  /** Échange un code de transfert (connexion faite sur un autre portail) contre une session. */
  async handoff(code: string, context: RequestContext): Promise<LoginOutcome> {
    const userId = await this.redis.getdel(handoffKey(code));
    if (userId === null) {
      throw new UnauthorizedException('Lien de connexion expiré, reconnectez-vous.');
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (user === null || context.portal !== portalForRole(user.role)) {
      throw new UnauthorizedException('Lien de connexion invalide.');
    }
    this.assertCanSignIn(user);
    return {
      status: 'authenticated',
      user: toCurrentUser(user),
      tokens: await this.tokens.createSession(user, context),
    };
  }

  async refresh(
    refreshToken: string,
    context: RequestContext,
  ): Promise<{ user: CurrentUser; tokens: SessionTokens }> {
    const { userId, ...tokens } = await this.tokens.rotate(refreshToken, context);
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (user?.status !== 'ACTIVE') {
      await this.tokens.revoke(tokens.refreshToken);
      throw new UnauthorizedException('Session expirée, reconnectez-vous.');
    }
    return { user: toCurrentUser(user), tokens };
  }

  async logout(refreshToken: string | undefined, actorId: string | null, context: RequestContext) {
    if (refreshToken !== undefined) {
      await this.tokens.revoke(refreshToken);
    }
    if (actorId !== null) {
      await this.audit.log({ action: 'auth.logout', actorId, ip: context.ip });
    }
  }

  async me(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (user === null) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous.');
    }
    return toCurrentUser(user);
  }

  private async completeLogin(
    user: User,
    context: RequestContext,
    method: 'password' | 'otp',
  ): Promise<LoginOutcome> {
    this.assertCanSignIn(user);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      action: 'auth.login',
      actorId: user.id,
      metadata: { method, portal: context.portal ?? 'unknown' },
      ip: context.ip,
    });

    const target = portalForRole(user.role);
    if (target === context.portal) {
      return {
        status: 'authenticated',
        user: toCurrentUser(user),
        tokens: await this.tokens.createSession(user, context),
      };
    }

    const code = randomBytes(32).toString('base64url');
    await this.redis.set(handoffKey(code), user.id, 'EX', HANDOFF_TTL_SECONDS);
    const origin = buildPortalOrigin(target, {
      host: context.host,
      rootDomain: this.config.APP_DOMAIN,
      secure: context.secure,
    });
    const redirectUrl = new URL(HANDOFF_PATH, origin);
    redirectUrl.searchParams.set('code', code);
    return { status: 'redirect', portal: target, redirectUrl: redirectUrl.toString() };
  }

  private assertCanSignIn(user: User): void {
    if (user.status === 'SUSPENDED') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_SUSPENDED',
        'Ce compte est suspendu. Contactez le support.',
      );
    }
    if (user.status !== 'ACTIVE') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'PHONE_NOT_VERIFIED',
        'Vérifiez votre numéro de téléphone pour continuer.',
      );
    }
  }

  private findByPhone(nationalPhone: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { phone: toE164(nationalPhone), deletedAt: null } });
  }
}

function phoneAlreadyUsed(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'PHONE_ALREADY_USED',
    'Ce numéro est déjà associé à un compte.',
  );
}

function emailAlreadyUsed(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'EMAIL_ALREADY_USED',
    'Cet email est déjà associé à un compte.',
  );
}

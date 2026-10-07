import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import {
  type Locale,
  OTP_LENGTH,
  type OtpChannel,
  type OtpDispatch,
  type OtpPurpose,
  toE164,
} from '@drivetn/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService, tooManyRequests } from '../rate-limit/rate-limit.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
/** Plafonds anti-spam (et anti-coûts SMS) : par numéro et par adresse IP. */
export const OTP_PHONE_LIMIT = { limit: 5, windowSeconds: 60 * 60 };
export const OTP_IP_LIMIT = { limit: 20, windowSeconds: 60 * 60 };

export interface SendOtpParams {
  /** Numéro national à 8 chiffres. */
  phone: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  locale: Locale;
  ip: string | null;
  /**
   * `false` quand le compte n'est pas éligible : les limites s'appliquent et la réponse est
   * identique, mais rien n'est envoyé (pas de divulgation des numéros inscrits).
   */
  deliver: boolean;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly rateLimit: RateLimitService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  async send(params: SendOtpParams): Promise<OtpDispatch> {
    const phone = toE164(params.phone);
    await this.applyCooldown(phone, params.purpose);
    await this.rateLimit.consume(`otp:phone:${phone}`, OTP_PHONE_LIMIT);
    await this.rateLimit.consume(`otp:ip:${params.ip ?? 'unknown'}`, OTP_IP_LIMIT);

    if (params.deliver) {
      const code = randomInt(0, 10 ** OTP_LENGTH)
        .toString()
        .padStart(OTP_LENGTH, '0');
      await this.prisma.otpCode.create({
        data: {
          phone,
          purpose: params.purpose,
          channel: params.channel,
          codeHash: this.hashCode(phone, params.purpose, code),
          expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        },
      });
      await this.messaging.enqueue({
        template: 'otp',
        channel: params.channel,
        to: phone,
        locale: params.locale,
        code,
        purpose: params.purpose,
        expiresInMinutes: OTP_TTL_SECONDS / 60,
      });
    }

    return {
      phone: params.phone,
      expiresInSeconds: OTP_TTL_SECONDS,
      resendInSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  /** Vérifie le dernier code envoyé pour ce numéro et cet usage, puis le consomme. */
  async verify(nationalPhone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const phone = toE164(nationalPhone);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (otp === null || otp.expiresAt.getTime() <= Date.now()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'OTP_EXPIRED',
        'Code expiré, demandez-en un nouveau.',
      );
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw tooManyAttempts();
    }

    if (!this.matches(otp.codeHash, this.hashCode(phone, purpose, code))) {
      const updated = await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const attemptsLeft = OTP_MAX_ATTEMPTS - updated.attempts;
      if (attemptsLeft <= 0) {
        throw tooManyAttempts();
      }
      throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Code incorrect.', {
        attemptsLeft,
      });
    }

    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_EXPIRED', 'Code déjà utilisé.');
    }
  }

  private async applyCooldown(phone: string, purpose: OtpPurpose): Promise<void> {
    const key = `drivetn:otp:cooldown:${purpose}:${phone}`;
    const acquired = await this.redis.set(key, '1', 'EX', OTP_RESEND_COOLDOWN_SECONDS, 'NX');
    if (acquired === null) {
      const ttl = await this.redis.ttl(key);
      throw tooManyRequests(ttl > 0 ? ttl : OTP_RESEND_COOLDOWN_SECONDS);
    }
  }

  private hashCode(phone: string, purpose: OtpPurpose, code: string): string {
    return createHmac('sha256', this.config.OTP_HASH_SECRET)
      .update(`${phone}:${purpose}:${code}`)
      .digest('hex');
  }

  private matches(expectedHex: string, actualHex: string): boolean {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(actualHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

function tooManyAttempts(): AppException {
  return new AppException(
    HttpStatus.TOO_MANY_REQUESTS,
    'OTP_TOO_MANY_ATTEMPTS',
    'Trop de tentatives, demandez un nouveau code.',
  );
}

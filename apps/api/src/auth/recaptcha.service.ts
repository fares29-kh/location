import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { REDIS_CLIENT } from '../redis/redis.constants';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const VERIFY_TIMEOUT_MS = 5_000;
/** Fenêtre pendant laquelle un renvoi de code de connexion n'exige pas une nouvelle case. */
const LOGIN_OTP_GRACE_SECONDS = 15 * 60;

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
}

function graceKey(email: string): string {
  return `drivetn:captcha:login-otp:${email}`;
}

/** Vérifie le jeton reCAPTCHA v2. Sans secret configuré, la vérification est ignorée. */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: Env,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Chaque connexion par mot de passe exige un jeton frais. */
  async assertToken(token: string | undefined, ip: string | null): Promise<void> {
    if (this.config.RECAPTCHA_SECRET_KEY === '') {
      return;
    }
    const accepted = await this.verify(token, ip);
    if (!accepted) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAPTCHA_FAILED',
        'La vérification anti-robot a échoué.',
      );
    }
  }

  /**
   * Premier envoi du code de connexion : la case est obligatoire.
   * Un renvoi pour le même email reste accepté pendant le délai du code.
   */
  async assertLoginOtp(email: string, token: string | undefined, ip: string | null): Promise<void> {
    if (this.config.RECAPTCHA_SECRET_KEY === '') {
      return;
    }
    if (token !== undefined) {
      await this.assertToken(token, ip);
      await this.redis.set(graceKey(email), '1', 'EX', LOGIN_OTP_GRACE_SECONDS);
      return;
    }
    const granted = await this.redis.get(graceKey(email));
    if (granted === null) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CAPTCHA_FAILED',
        'La vérification anti-robot a échoué.',
      );
    }
  }

  private async verify(token: string | undefined, ip: string | null): Promise<boolean> {
    if (token === undefined) {
      return false;
    }
    const body = new URLSearchParams({
      secret: this.config.RECAPTCHA_SECRET_KEY,
      response: token,
    });
    if (ip !== null && ip.length > 0) {
      body.set('remoteip', ip);
    }
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as SiteverifyResponse;
      return payload.success === true && this.hostnameAllowed(payload.hostname);
    } catch (error) {
      this.logger.warn(
        `Vérification reCAPTCHA impossible : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
      return false;
    }
  }

  /** Le jeton doit venir de ce domaine ou d'un sous-domaine (agency, admin, app). */
  private hostnameAllowed(hostname: string | undefined): boolean {
    if (hostname === undefined || hostname.length === 0) {
      return false;
    }
    const domain = this.config.APP_DOMAIN;
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }
}

import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../config/env';
import { OriginGuard } from './origin.guard';

const config = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  APP_DOMAIN: 'drivetn.tn',
  CORS_ORIGINS: 'https://partenaire.example',
  JWT_ACCESS_SECRET: 'jwt-secret-de-test-suffisamment-long',
  OTP_HASH_SECRET: 'otp-secret-de-test-suffisamment-long',
});

function httpContext(method: string, headers: Record<string, string>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  const guard = new OriginGuard(config);

  it('laisse passer les lectures quelle que soit l’origine', () => {
    expect(guard.canActivate(httpContext('GET', { origin: 'https://evil.example' }))).toBe(true);
  });

  it('accepte les écritures venant d’un portail ou d’une origine CORS autorisée', () => {
    for (const origin of [
      'https://drivetn.tn',
      'https://agency.drivetn.tn',
      'https://admin.drivetn.tn',
      'https://partenaire.example',
    ]) {
      expect(guard.canActivate(httpContext('POST', { origin }))).toBe(true);
    }
  });

  it('se rabat sur le Referer et accepte les clients sans origine (serveur Next.js)', () => {
    expect(
      guard.canActivate(httpContext('POST', { referer: 'https://app.drivetn.tn/login' })),
    ).toBe(true);
    expect(guard.canActivate(httpContext('POST', {}))).toBe(true);
  });

  it('refuse les écritures d’une origine étrangère ou invalide', () => {
    for (const origin of ['https://evil.example', 'https://drivetn.tn.evil.example', 'null']) {
      expect(() => guard.canActivate(httpContext('PATCH', { origin }))).toThrow(ForbiddenException);
    }
  });
});

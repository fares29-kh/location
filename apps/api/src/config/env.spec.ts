import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const validSource = {
  DATABASE_URL: 'postgresql://drivetn:secret@postgres:5432/drivetn?schema=public',
  REDIS_URL: 'redis://:secret@redis:6379',
  JWT_ACCESS_SECRET: 'jwt-secret-de-test-suffisamment-long',
  OTP_HASH_SECRET: 'otp-secret-de-test-suffisamment-long',
};

describe('parseEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = parseEnv(validSource);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      APP_NAME: 'DriveTN',
      APP_DOMAIN: 'localhost',
      APP_TIMEZONE: 'Africa/Tunis',
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: false,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      COOKIE_SECURE: false,
      MESSAGING_PROVIDER: 'console',
      SEED_DEMO_ACCOUNTS: false,
    });
  });

  it('convertit les types', () => {
    const env = parseEnv({
      ...validSource,
      PORT: '8080',
      SWAGGER_ENABLED: 'true',
      COOKIE_SECURE: 'true',
      ACCESS_TOKEN_TTL_SECONDS: '600',
      CORS_ORIGINS: 'http://localhost, http://agency.localhost ,',
    });
    expect(env.PORT).toBe(8080);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(600);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost', 'http://agency.localhost']);
  });

  it('refuse une configuration sans base de données', () => {
    const { DATABASE_URL: _omitted, ...rest } = validSource;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('refuse une URL Redis avec un mauvais protocole', () => {
    expect(() => parseEnv({ ...validSource, REDIS_URL: 'http://redis:6379' })).toThrow(/REDIS_URL/);
  });

  it('refuse un port invalide', () => {
    expect(() => parseEnv({ ...validSource, PORT: '70000' })).toThrow(/PORT/);
  });

  it('refuse un secret JWT trop court', () => {
    expect(() => parseEnv({ ...validSource, JWT_ACCESS_SECRET: 'court' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});

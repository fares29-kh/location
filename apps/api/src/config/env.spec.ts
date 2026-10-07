import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const validSource = {
  DATABASE_URL: 'postgresql://drivetn:secret@postgres:5432/drivetn?schema=public',
  REDIS_URL: 'redis://:secret@redis:6379',
};

describe('parseEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = parseEnv(validSource);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      APP_NAME: 'DriveTN',
      APP_TIMEZONE: 'Africa/Tunis',
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: false,
    });
  });

  it('convertit les types', () => {
    const env = parseEnv({
      ...validSource,
      PORT: '8080',
      SWAGGER_ENABLED: 'true',
      CORS_ORIGINS: 'http://localhost, http://agency.localhost ,',
    });
    expect(env.PORT).toBe(8080);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost', 'http://agency.localhost']);
  });

  it('refuse une configuration sans base de données', () => {
    expect(() => parseEnv({ REDIS_URL: validSource.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it('refuse une URL Redis avec un mauvais protocole', () => {
    expect(() => parseEnv({ ...validSource, REDIS_URL: 'http://redis:6379' })).toThrow(/REDIS_URL/);
  });

  it('refuse un port invalide', () => {
    expect(() => parseEnv({ ...validSource, PORT: '70000' })).toThrow(/PORT/);
  });
});

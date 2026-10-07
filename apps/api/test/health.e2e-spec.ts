import { errorResponseSchema, healthResponseSchema } from '@drivetn/types';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { APP_CONFIG } from '../src/config/config.constants';
import { parseEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';

const config = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  SWAGGER_ENABLED: 'true',
});

const prisma = { $queryRaw: vi.fn() };
const redis = { ping: vi.fn(), get: vi.fn(), quit: vi.fn() };

describe('API santé (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(REDIS_CLIENT)
      .useValue(redis)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    redis.get.mockResolvedValue('2026-10-07T08:00:00.000Z');
  });

  it('GET /api/v1/health renvoie 200 et un corps conforme au schéma partagé', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('GET /api/v1/health renvoie 503 quand Redis est indisponible', async () => {
    redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);
    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      status: 'error',
      checks: { redis: 'down', worker: 'down', database: 'up' },
    });
  });

  it('applique les en-têtes de sécurité Helmet', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('renvoie une erreur normalisée pour une route inconnue', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/inconnu').expect(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('NOT_FOUND');
  });

  it('expose la spécification OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs/json').expect(200);
    expect(response.body).toHaveProperty(['paths', '/api/v1/health']);
  });
});

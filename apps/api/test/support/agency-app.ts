import type { Paginated } from '@drivetn/types';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import type { AccessTokenPayload } from '../../src/common/auth/authenticated-user';
import { APP_CONFIG } from '../../src/config/config.constants';
import { parseEnv } from '../../src/config/env';
import { MessagingService } from '../../src/messaging/messaging.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MEDIA_URL } from './agency-fixtures';

export const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
export const e2eRedisUrl = process.env.E2E_REDIS_URL;
export const e2eEnabled = e2eDatabaseUrl !== undefined && e2eRedisUrl !== undefined;

export interface AgencyTestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  /** Requête authentifiée en tant que gérant d'agence (jeton d'accès signé comme à la connexion). */
  as: (ownerId: string) => AuthenticatedAgent;
  /** Requête authentifiée en tant que client, sur `/api/v1`. */
  asCustomer: (customerId: string) => AuthenticatedAgent;
}

export interface AuthenticatedAgent {
  get: (path: string) => request.Test;
  post: (path: string) => request.Test;
  put: (path: string) => request.Test;
  patch: (path: string) => request.Test;
  delete: (path: string) => request.Test;
}

export function body<T>(response: request.Response & { body: T }): T {
  return response.body as T;
}

/** Toutes les pages d'une liste paginée, de la première à la dernière. */
export async function allPages<T, P extends Paginated<T> = Paginated<T>>(
  agent: AuthenticatedAgent,
  path: string,
  limit = 100,
): Promise<P[]> {
  const separator = path.includes('?') ? '&' : '?';
  const pages: P[] = [];
  for (let page = 1; ; page += 1) {
    const current = body<P>(
      await agent.get(`${path}${separator}limit=${limit}&page=${page}`).expect(200),
    );
    pages.push(current);
    if (page >= current.pageCount) {
      return pages;
    }
  }
}

/** Application complète (guards globaux compris) sur la base et le Redis de test. */
export async function createAgencyTestApp(
  urls: { databaseUrl?: string; redisUrl?: string } = {
    databaseUrl: e2eDatabaseUrl,
    redisUrl: e2eRedisUrl,
  },
): Promise<AgencyTestApp> {
  const config = parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: urls.databaseUrl,
    REDIS_URL: urls.redisUrl,
    APP_DOMAIN: 'localhost',
    MEDIA_PUBLIC_URL: MEDIA_URL,
    JWT_ACCESS_SECRET: 'jwt-secret-de-test-suffisamment-long',
    OTP_HASH_SECRET: 'otp-secret-de-test-suffisamment-long',
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(MessagingService)
    .useValue({ enqueue: () => Promise.resolve() })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, config);
  await app.init();
  const jwt = app.get(JwtService);
  const server = app.getHttpServer() as Parameters<typeof request>[0];

  const agent = (payload: AccessTokenPayload, prefix: string): AuthenticatedAgent => {
    // Jeton signé à chaque requête : les tests déplacent l'horloge au-delà de sa durée de vie.
    const authorization = () => `Bearer ${jwt.sign(payload)}`;
    const http = request(server);
    return {
      get: (path) => http.get(`${prefix}${path}`).set('Authorization', authorization()),
      post: (path) => http.post(`${prefix}${path}`).set('Authorization', authorization()),
      put: (path) => http.put(`${prefix}${path}`).set('Authorization', authorization()),
      patch: (path) => http.patch(`${prefix}${path}`).set('Authorization', authorization()),
      delete: (path) => http.delete(`${prefix}${path}`).set('Authorization', authorization()),
    };
  };

  return {
    app,
    prisma: app.get(PrismaService),
    as: (ownerId) =>
      agent({ sub: ownerId, role: 'AGENCY_OWNER', adminRole: null }, '/api/v1/agency'),
    asCustomer: (customerId) =>
      agent({ sub: customerId, role: 'CUSTOMER', adminRole: null }, '/api/v1'),
  };
}

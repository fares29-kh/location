import {
  ACCESS_TOKEN_COOKIE,
  authResultSchema,
  currentUserSchema,
  errorResponseSchema,
  otpDispatchSchema,
  REFRESH_TOKEN_COOKIE,
  toE164,
} from '@drivetn/types';
import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { Roles } from '../src/common/auth/decorators';
import { APP_CONFIG } from '../src/config/config.constants';
import { parseEnv } from '../src/config/env';
import { MessagingService } from '../src/messaging/messaging.service';
import type { MessageJob } from '../src/messaging/messaging.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';

/**
 * Parcours d'authentification complet sur une vraie base PostgreSQL migrée et un vrai Redis
 * (services de la CI). Ignoré sans `E2E_DATABASE_URL` / `E2E_REDIS_URL`.
 */
const databaseUrl = process.env.E2E_DATABASE_URL;
const redisUrl = process.env.E2E_REDIS_URL;

const CLIENT_HOST = 'localhost';
const AGENCY_HOST = 'agency.localhost';
const ADMIN_HOST = 'admin.localhost';
const PASSWORD = 'Voiture2026';

@Controller({ path: 'e2e-admin', version: '1' })
class AdminOnlyController {
  @Roles('ADMIN')
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [AdminOnlyController] })
class AdminOnlyModule {}

function cookiesFrom(response: request.Response): Record<string, string> {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  const list = header === undefined ? [] : Array.isArray(header) ? header : [header];
  return Object.fromEntries(
    list.map((cookie) => {
      const [pair = ''] = cookie.split(';');
      const separator = pair.indexOf('=');
      return [pair.slice(0, separator), pair.slice(separator + 1)];
    }),
  );
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

describe.skipIf(databaseUrl === undefined || redisUrl === undefined)(
  'Authentification (e2e)',
  () => {
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let redis: Redis;
    let passwords: PasswordService;
    const sent: MessageJob[] = [];

    const http = () => request(app.getHttpServer());

    function lastCode(to: string): string {
      const job = sent.findLast((message) => message.template === 'otp' && message.to === to);
      if (job?.template !== 'otp') {
        throw new Error(`Aucun code envoyé à ${to}`);
      }
      return job.code;
    }

    async function createUser(
      phone: string,
      role: 'CUSTOMER' | 'AGENCY_OWNER' | 'ADMIN',
      status: 'ACTIVE' | 'PENDING_VERIFICATION' = 'ACTIVE',
      email?: string,
    ) {
      return prisma.user.create({
        data: {
          phone: toE164(phone),
          role,
          adminRole: role === 'ADMIN' ? 'SUPER_ADMIN' : null,
          status,
          firstName: 'Test',
          lastName: role,
          email: email ?? null,
          passwordHash: await passwords.hash(PASSWORD),
          phoneVerifiedAt: status === 'ACTIVE' ? new Date() : null,
          emailVerifiedAt: status === 'ACTIVE' && email !== undefined ? new Date() : null,
        },
      });
    }

    async function login(host: string, identifier: string, password = PASSWORD) {
      return http().post('/api/v1/auth/login').set('Host', host).send({ identifier, password });
    }

    beforeAll(async () => {
      const config = parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
        APP_DOMAIN: 'localhost',
        JWT_ACCESS_SECRET: 'jwt-secret-de-test-suffisamment-long',
        OTP_HASH_SECRET: 'otp-secret-de-test-suffisamment-long',
      });
      const moduleRef = await Test.createTestingModule({ imports: [AppModule, AdminOnlyModule] })
        .overrideProvider(APP_CONFIG)
        .useValue(config)
        .overrideProvider(MessagingService)
        .useValue({
          enqueue: (job: MessageJob) => {
            sent.push(job);
            return Promise.resolve();
          },
        })
        .compile();

      app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
      configureApp(app, config);
      await app.init();
      prisma = app.get(PrismaService);
      redis = app.get<Redis>(REDIS_CLIENT);
      passwords = app.get(PasswordService);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      sent.length = 0;
      await redis.flushdb();
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE refresh_tokens, otp_codes, audit_logs, users RESTART IDENTITY CASCADE',
      );
    });

    it('inscrit un client, confirme son email par code et ouvre la session', async () => {
      const signup = await http()
        .post('/api/v1/auth/signup')
        .set('Host', CLIENT_HOST)
        .send({
          firstName: 'Amira',
          lastName: 'Trabelsi',
          phone: '98123456',
          email: 'Amira@Example.tn',
          password: PASSWORD,
        })
        .expect(201);
      expect(signup.body).toMatchObject({
        phone: '98123456',
        email: 'amira@example.tn',
        expiresInSeconds: 600,
        resendInSeconds: 60,
      });

      const code = lastCode('amira@example.tn');
      const wrong = await http()
        .post('/api/v1/auth/otp/verify')
        .set('Host', CLIENT_HOST)
        .send({ email: 'amira@example.tn', code: code === '000000' ? '111111' : '000000' })
        .expect(400);
      expect(errorResponseSchema.parse(wrong.body)).toMatchObject({
        code: 'OTP_INVALID',
        details: { attemptsLeft: 4 },
      });

      const verified = await http()
        .post('/api/v1/auth/otp/verify')
        .set('Host', CLIENT_HOST)
        .send({ email: 'amira@example.tn', code })
        .expect(200);
      const result = authResultSchema.parse(verified.body);
      expect(result).toMatchObject({ status: 'authenticated', user: { role: 'CUSTOMER' } });
      const cookies = cookiesFrom(verified);
      expect(cookies[ACCESS_TOKEN_COOKIE]).toBeTruthy();
      expect(cookies[REFRESH_TOKEN_COOKIE]).toBeTruthy();

      const me = await http()
        .get('/api/v1/auth/me')
        .set('Cookie', cookieHeader(cookies))
        .expect(200);
      expect(currentUserSchema.parse(me.body)).toMatchObject({
        phone: '98123456',
        email: 'amira@example.tn',
        phoneVerified: false,
        emailVerified: true,
        status: 'ACTIVE',
      });

      const audit = await prisma.auditLog.findMany({ select: { action: true } });
      expect(audit.map((entry) => entry.action)).toEqual(
        expect.arrayContaining(['auth.signup', 'auth.email_verified', 'auth.login']),
      );
    });

    it('inscrit un gérant d’agence sur le portail agence et refuse l’inscription admin', async () => {
      await http()
        .post('/api/v1/auth/signup')
        .set('Host', AGENCY_HOST)
        .send({
          firstName: 'Karim',
          lastName: 'Ben Ali',
          phone: '22123456',
          email: 'karim@example.tn',
          password: PASSWORD,
        })
        .expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { phone: toE164('22123456') } });
      expect(user.role).toBe('AGENCY_OWNER');

      await http()
        .post('/api/v1/auth/signup')
        .set('Host', ADMIN_HOST)
        .send({
          firstName: 'Eve',
          lastName: 'Admin',
          phone: '23123456',
          email: 'eve@example.tn',
          password: PASSWORD,
        })
        .expect(403);
    });

    it('refuse un numéro déjà vérifié et impose le délai de renvoi du code', async () => {
      await createUser('98000001', 'CUSTOMER');
      const duplicate = await http()
        .post('/api/v1/auth/signup')
        .set('Host', CLIENT_HOST)
        .send({
          firstName: 'A',
          lastName: 'B',
          phone: '98000001',
          email: 'autre@example.tn',
          password: PASSWORD,
        })
        .expect(409);
      expect(errorResponseSchema.parse(duplicate.body).code).toBe('PHONE_ALREADY_USED');

      await createUser('98000002', 'CUSTOMER', 'PENDING_VERIFICATION', 'pending@example.tn');
      await http()
        .post('/api/v1/auth/otp/request')
        .set('Host', CLIENT_HOST)
        .send({ email: 'pending@example.tn', purpose: 'SIGNUP' })
        .expect(202);
      const again = await http()
        .post('/api/v1/auth/otp/request')
        .set('Host', CLIENT_HOST)
        .send({ email: 'pending@example.tn', purpose: 'SIGNUP' })
        .expect(429);
      expect(errorResponseSchema.parse(again.body)).toMatchObject({
        code: 'TOO_MANY_REQUESTS',
        details: { retryAfterSeconds: expect.any(Number) as number },
      });
    });

    it('connecte par mot de passe, refuse un mauvais mot de passe et un téléphone non vérifié', async () => {
      await createUser('98000003', 'CUSTOMER');
      const bad = await login(CLIENT_HOST, '98000003', 'Mauvais2026');
      expect(bad.status).toBe(401);
      expect(errorResponseSchema.parse(bad.body).code).toBe('INVALID_CREDENTIALS');

      const ok = await login(CLIENT_HOST, '+216 98 000 003');
      expect(ok.status).toBe(200);
      expect(authResultSchema.parse(ok.body).status).toBe('authenticated');

      await createUser('98000004', 'CUSTOMER', 'PENDING_VERIFICATION', 'pending4@example.tn');
      const pending = await login(CLIENT_HOST, '98000004');
      expect(pending.status).toBe(403);
      expect(pending.body).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        details: { email: 'pending4@example.tn' },
      });
    });

    it('connecte par code email sans révéler si l’adresse est inscrite', async () => {
      await createUser('98000005', 'CUSTOMER', 'ACTIVE', 'known@example.tn');
      const known = await http()
        .post('/api/v1/auth/otp/request')
        .set('Host', CLIENT_HOST)
        .send({ email: 'known@example.tn', purpose: 'LOGIN' })
        .expect(202);
      const unknown = await http()
        .post('/api/v1/auth/otp/request')
        .set('Host', CLIENT_HOST)
        .send({ email: 'unknown@example.tn', purpose: 'LOGIN' })
        .expect(202);
      expect(otpDispatchSchema.parse(unknown.body)).toEqual({
        ...otpDispatchSchema.parse(known.body),
        email: 'unknown@example.tn',
      });
      expect(sent.map((job) => job.to)).toEqual(['known@example.tn']);

      const response = await http()
        .post('/api/v1/auth/login/otp')
        .set('Host', CLIENT_HOST)
        .send({ email: 'known@example.tn', code: lastCode('known@example.tn') })
        .expect(200);
      expect(authResultSchema.parse(response.body).status).toBe('authenticated');
    });

    it('redirige vers le portail du rôle avec un code de transfert à usage unique', async () => {
      await createUser('22000001', 'AGENCY_OWNER');
      const response = await login(CLIENT_HOST, '22000001');
      const result = authResultSchema.parse(response.body);
      if (result.status !== 'redirect') {
        throw new Error('redirection attendue');
      }
      expect(result.portal).toBe('agency');
      expect(cookiesFrom(response)[ACCESS_TOKEN_COOKIE]).toBeUndefined();
      const url = new URL(result.redirectUrl);
      expect(url.host).toBe(AGENCY_HOST);
      expect(url.pathname).toBe('/auth/handoff');
      const code = url.searchParams.get('code') ?? '';

      await http().post('/api/v1/auth/handoff').set('Host', CLIENT_HOST).send({ code }).expect(401);

      const second = await login(CLIENT_HOST, '22000001');
      const secondResult = authResultSchema.parse(second.body);
      const secondCode =
        secondResult.status === 'redirect'
          ? (new URL(secondResult.redirectUrl).searchParams.get('code') ?? '')
          : '';
      const handoff = await http()
        .post('/api/v1/auth/handoff')
        .set('Host', AGENCY_HOST)
        .send({ code: secondCode })
        .expect(200);
      expect(authResultSchema.parse(handoff.body)).toMatchObject({ status: 'authenticated' });
      expect(cookiesFrom(handoff)[ACCESS_TOKEN_COOKIE]).toBeTruthy();

      await http()
        .post('/api/v1/auth/handoff')
        .set('Host', AGENCY_HOST)
        .send({ code: secondCode })
        .expect(401);
    });

    it('fait tourner le refresh token et révoque la famille en cas de réutilisation', async () => {
      await createUser('98000006', 'CUSTOMER');
      const first = cookiesFrom(await login(CLIENT_HOST, '98000006'));
      const firstRefresh = first[REFRESH_TOKEN_COOKIE] ?? '';

      const rotated = await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=${firstRefresh}`)
        .expect(200);
      const secondRefresh = cookiesFrom(rotated)[REFRESH_TOKEN_COOKIE] ?? '';
      expect(secondRefresh).not.toBe(firstRefresh);

      await prisma.refreshToken.updateMany({
        where: { revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });
      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=${firstRefresh}`)
        .expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', `${REFRESH_TOKEN_COOKIE}=${secondRefresh}`)
        .expect(401);
      const reuse = await prisma.auditLog.count({ where: { action: 'auth.refresh_token_reused' } });
      expect(reuse).toBe(1);
    });

    it('déconnecte et ferme toutes les sessions après réinitialisation du mot de passe', async () => {
      await createUser('98000007', 'CUSTOMER', 'ACTIVE', 'reset@example.tn');
      const session = cookiesFrom(await login(CLIENT_HOST, '98000007'));

      await http()
        .post('/api/v1/auth/password/forgot')
        .set('Host', CLIENT_HOST)
        .send({ email: 'reset@example.tn' })
        .expect(202);
      await http()
        .post('/api/v1/auth/password/reset')
        .set('Host', CLIENT_HOST)
        .send({
          email: 'reset@example.tn',
          code: lastCode('reset@example.tn'),
          password: 'Nouveau2026',
        })
        .expect(204);

      await http().post('/api/v1/auth/refresh').set('Cookie', cookieHeader(session)).expect(401);
      expect((await login(CLIENT_HOST, '98000007')).status).toBe(401);
      const fresh = cookiesFrom(await login(CLIENT_HOST, '98000007', 'Nouveau2026'));

      await http().post('/api/v1/auth/logout').set('Cookie', cookieHeader(fresh)).expect(204);
      await http().post('/api/v1/auth/refresh').set('Cookie', cookieHeader(fresh)).expect(401);
    });

    it('applique les rôles et la protection d’origine', async () => {
      await createUser('98000008', 'CUSTOMER');
      await createUser('20000009', 'ADMIN');
      const customer = cookiesFrom(await login(CLIENT_HOST, '98000008'));
      const admin = cookiesFrom(await login(ADMIN_HOST, '20000009'));

      await http().get('/api/v1/e2e-admin').expect(401);
      await http().get('/api/v1/e2e-admin').set('Cookie', cookieHeader(customer)).expect(403);
      await http().get('/api/v1/e2e-admin').set('Cookie', cookieHeader(admin)).expect(200);

      await http()
        .post('/api/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ identifier: '98000008', password: PASSWORD })
        .expect(403);
      await http()
        .post('/api/v1/auth/login')
        .set('Origin', 'http://agency.localhost')
        .send({ identifier: '98000008', password: PASSWORD })
        .expect(200);
    });

    it('met à jour le profil et change le mot de passe en gardant la session courante', async () => {
      await createUser('98000010', 'CUSTOMER');
      const otherDevice = cookiesFrom(await login(CLIENT_HOST, '98000010'));
      const current = cookiesFrom(await login(CLIENT_HOST, '98000010'));

      const profile = await http()
        .patch('/api/v1/users/me')
        .set('Cookie', cookieHeader(current))
        .send({ firstName: 'Sami', lastName: 'Haddad', email: 'Sami@Example.tn', locale: 'ar' })
        .expect(200);
      expect(currentUserSchema.parse(profile.body)).toMatchObject({
        firstName: 'Sami',
        email: 'sami@example.tn',
        locale: 'ar',
      });

      await http()
        .post('/api/v1/users/me/password')
        .set('Cookie', cookieHeader(current))
        .send({ currentPassword: 'Mauvais2026', newPassword: 'Nouveau2026' })
        .expect(400);
      await http()
        .post('/api/v1/users/me/password')
        .set('Cookie', cookieHeader(current))
        .send({ currentPassword: PASSWORD, newPassword: 'Nouveau2026' })
        .expect(204);

      await http().post('/api/v1/auth/refresh').set('Cookie', cookieHeader(current)).expect(200);
      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieHeader(otherDevice))
        .expect(401);
    });
  },
);

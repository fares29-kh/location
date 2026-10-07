import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppException } from '../common/errors/app.exception';
import { normalizeException } from '../common/filters/http-exception.filter';
import { parseEnv } from '../config/env';
import type { MessagingService } from '../messaging/messaging.service';
import type { OtpMessageJob } from '../messaging/messaging.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { RateLimitService } from '../rate-limit/rate-limit.service';
import { OTP_MAX_ATTEMPTS, OtpService } from './otp.service';

const config = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'jwt-secret-de-test-suffisamment-long',
  OTP_HASH_SECRET: 'otp-secret-de-test-suffisamment-long',
});

interface StoredOtp {
  id: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
}

function setup() {
  const otpCode = {
    create: vi.fn<(args: { data: StoredOtp }) => Promise<unknown>>().mockResolvedValue({}),
    findFirst: vi.fn<() => Promise<StoredOtp | null>>(),
    update: vi.fn<() => Promise<{ attempts: number }>>(),
    updateMany: vi.fn<() => Promise<{ count: number }>>().mockResolvedValue({ count: 1 }),
  };
  const enqueue = vi.fn<(job: OtpMessageJob) => Promise<void>>().mockResolvedValue();
  const consume = vi.fn<() => Promise<void>>().mockResolvedValue();
  const redis = {
    set: vi.fn<() => Promise<'OK' | null>>().mockResolvedValue('OK'),
    ttl: vi.fn<() => Promise<number>>().mockResolvedValue(42),
  };
  const service = new OtpService(
    { otpCode } as unknown as PrismaService,
    { enqueue } as unknown as MessagingService,
    { consume } as unknown as RateLimitService,
    redis as unknown as Redis,
    config,
  );
  return { service, otpCode, enqueue, consume, redis };
}

const SEND = {
  phone: '98123456',
  purpose: 'SIGNUP',
  channel: 'SMS',
  locale: 'fr',
  ip: '10.0.0.1',
  deliver: true,
} as const;

/** Envoie un code et renvoie la valeur reçue par SMS et l'enregistrement stocké. */
async function sendCode(context: ReturnType<typeof setup>) {
  await context.service.send(SEND);
  const job = context.enqueue.mock.calls[0]?.[0];
  const data = context.otpCode.create.mock.calls[0]?.[0].data;
  if (job === undefined || data === undefined) {
    throw new Error('code non envoyé');
  }
  const stored: StoredOtp = {
    id: 'otp-1',
    codeHash: data.codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
  };
  return { code: job.code, stored };
}

/** Corps d'erreur normalisé (code, details) renvoyé au client pour une AppException. */
async function rejection(promise: Promise<unknown>) {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof AppException)) {
    throw new Error('AppException attendue');
  }
  return normalizeException(error).body;
}

describe('OtpService', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('envoie un code à 6 chiffres et ne stocke que son empreinte', async () => {
    const dispatch = await context.service.send(SEND);
    expect(dispatch).toEqual({ phone: '98123456', expiresInSeconds: 300, resendInSeconds: 60 });

    const job = context.enqueue.mock.calls[0]?.[0];
    expect(job).toMatchObject({ to: '+21698123456', purpose: 'SIGNUP', channel: 'SMS' });
    expect(job?.code).toMatch(/^\d{6}$/);
    const stored = context.otpCode.create.mock.calls[0]?.[0].data;
    expect(stored?.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.codeHash).not.toContain(job?.code);
    expect(context.consume).toHaveBeenCalledTimes(2);
  });

  it('applique les limites sans rien envoyer à un numéro non éligible', async () => {
    const dispatch = await context.service.send({ ...SEND, deliver: false });
    expect(dispatch.resendInSeconds).toBe(60);
    expect(context.enqueue).not.toHaveBeenCalled();
    expect(context.otpCode.create).not.toHaveBeenCalled();
    expect(context.consume).toHaveBeenCalledTimes(2);
  });

  it('refuse un renvoi pendant le délai d’attente', async () => {
    context.redis.set.mockResolvedValue(null);
    const error = await rejection(context.service.send(SEND));
    expect(error.code).toBe('TOO_MANY_REQUESTS');
    expect(error.details).toEqual({ retryAfterSeconds: 42 });
    expect(context.enqueue).not.toHaveBeenCalled();
  });

  it('valide et consomme le bon code', async () => {
    const { code, stored } = await sendCode(context);
    context.otpCode.findFirst.mockResolvedValue(stored);
    await expect(context.service.verify('98123456', 'SIGNUP', code)).resolves.toBeUndefined();
    expect(context.otpCode.updateMany).toHaveBeenCalledOnce();
  });

  it('ne valide pas le code d’un autre usage', async () => {
    const { code, stored } = await sendCode(context);
    context.otpCode.findFirst.mockResolvedValue(stored);
    context.otpCode.update.mockResolvedValue({ attempts: 1 });
    const error = await rejection(context.service.verify('98123456', 'LOGIN', code));
    expect(error.code).toBe('OTP_INVALID');
  });

  it('décompte les essais puis bloque le code', async () => {
    const { stored } = await sendCode(context);
    context.otpCode.findFirst.mockResolvedValue(stored);
    context.otpCode.update.mockResolvedValue({ attempts: 2 });
    const invalid = await rejection(context.service.verify('98123456', 'SIGNUP', '000000'));
    expect(invalid.code).toBe('OTP_INVALID');
    expect(invalid.details).toEqual({ attemptsLeft: OTP_MAX_ATTEMPTS - 2 });

    context.otpCode.update.mockResolvedValue({ attempts: OTP_MAX_ATTEMPTS });
    const last = await rejection(context.service.verify('98123456', 'SIGNUP', '000000'));
    expect(last.code).toBe('OTP_TOO_MANY_ATTEMPTS');

    context.otpCode.findFirst.mockResolvedValue({ ...stored, attempts: OTP_MAX_ATTEMPTS });
    const blocked = await rejection(context.service.verify('98123456', 'SIGNUP', '000000'));
    expect(blocked.code).toBe('OTP_TOO_MANY_ATTEMPTS');
  });

  it('refuse un code expiré, absent ou déjà consommé', async () => {
    const { code, stored } = await sendCode(context);
    context.otpCode.findFirst.mockResolvedValue({ ...stored, expiresAt: new Date(Date.now() - 1) });
    expect((await rejection(context.service.verify('98123456', 'SIGNUP', code))).code).toBe(
      'OTP_EXPIRED',
    );

    context.otpCode.findFirst.mockResolvedValue(null);
    expect((await rejection(context.service.verify('98123456', 'SIGNUP', code))).code).toBe(
      'OTP_EXPIRED',
    );

    context.otpCode.findFirst.mockResolvedValue(stored);
    context.otpCode.updateMany.mockResolvedValue({ count: 0 });
    expect((await rejection(context.service.verify('98123456', 'SIGNUP', code))).code).toBe(
      'OTP_EXPIRED',
    );
  });
});

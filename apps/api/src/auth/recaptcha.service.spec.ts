import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppException } from '../common/errors/app.exception';
import type { Env } from '../config/env';
import { RecaptchaService } from './recaptcha.service';

function service(
  secret: string,
  redis: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> },
) {
  return new RecaptchaService(
    { RECAPTCHA_SECRET_KEY: secret, APP_DOMAIN: 'madrasti.dev' } as Env,
    redis as never,
  );
}

describe('RecaptchaService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignore la vérification tant que le secret est vide', async () => {
    const redis = { get: vi.fn(), set: vi.fn() };
    await expect(service('', redis).assertToken(undefined, null)).resolves.toBeUndefined();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('accepte un jeton dont le domaine est un sous-domaine du site', async () => {
    const redis = { get: vi.fn(), set: vi.fn() };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            hostname: 'agency.madrasti.dev',
            action: 'login',
            score: 0.9,
          }),
      }),
    );
    await expect(service('secret', redis).assertToken('token', '1.2.3.4')).resolves.toBeUndefined();
  });

  it('refuse un score trop bas', async () => {
    const redis = { get: vi.fn(), set: vi.fn() };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            hostname: 'madrasti.dev',
            action: 'login',
            score: 0.1,
          }),
      }),
    );
    const outcome = await service('secret', redis)
      .assertToken('token', null)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(outcome).toBeInstanceOf(AppException);
  });

  it('refuse un jeton émis pour un autre domaine', async () => {
    const redis = { get: vi.fn(), set: vi.fn() };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, hostname: 'example.com' }),
      }),
    );
    const outcome = await service('secret', redis)
      .assertToken('token', null)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(outcome).toBeInstanceOf(AppException);
    expect((outcome as AppException).getResponse()).toMatchObject({ code: 'CAPTCHA_FAILED' });
  });

  it('autorise le renvoi du code après une case déjà validée', async () => {
    const redis = { get: vi.fn().mockResolvedValue('1'), set: vi.fn() };
    await expect(
      service('secret', redis).assertLoginOtp('a@b.c', undefined, null),
    ).resolves.toBeUndefined();
    expect(redis.get).toHaveBeenCalledWith('drivetn:captcha:login-otp:a@b.c');
  });

  it('autorise le renvoi du code de réinitialisation après une case déjà validée', async () => {
    const redis = { get: vi.fn().mockResolvedValue('1'), set: vi.fn() };
    await expect(
      service('secret', redis).assertPasswordReset('a@b.c', undefined, null),
    ).resolves.toBeUndefined();
    expect(redis.get).toHaveBeenCalledWith('drivetn:captcha:password-reset:a@b.c');
  });
});

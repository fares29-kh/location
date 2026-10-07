import type { CookieOptions, Response } from 'express';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../common/auth/auth.constants';
import type { Env } from '../config/env';
import type { SessionTokens } from './token.service';

function baseOptions(config: Env): CookieOptions {
  // Pas d'attribut Domain : chaque portail (sous-domaine) a sa propre session.
  return { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', path: '/' };
}

export function setSessionCookies(response: Response, tokens: SessionTokens, config: Env): void {
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(config),
    maxAge: config.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(config),
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(response: Response, config: Env): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions(config));
  response.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions(config));
}

export function readRefreshToken(cookies: unknown): string | undefined {
  const value = (cookies as Record<string, unknown> | undefined)?.[REFRESH_TOKEN_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

import { userRoleSchema } from '@drivetn/types';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { ACCESS_TOKEN_COOKIE, IS_PUBLIC_KEY } from './auth.constants';
import type { AccessTokenPayload, AuthenticatedUser } from './authenticated-user';

function extractAccessToken(request: Request): string | null {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  const fromCookie = cookies?.[ACCESS_TOKEN_COOKIE];
  if (fromCookie !== undefined && fromCookie.length > 0) {
    return fromCookie;
  }
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ') === true) {
    return authorization.slice('Bearer '.length).trim();
  }
  return null;
}

/**
 * Guard global : attache l'utilisateur de l'access token à la requête et exige une session
 * sauf sur les routes marquées `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token = extractAccessToken(request);
    if (token !== null) {
      const user = await this.verify(token);
      if (user !== null) {
        request.user = user;
      }
    }

    if (isPublic === true || request.user !== undefined) {
      return true;
    }
    throw new UnauthorizedException('Session absente ou expirée.');
  }

  private async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
      const role = userRoleSchema.safeParse(payload.role);
      if (!role.success || typeof payload.sub !== 'string') {
        return null;
      }
      return { id: payload.sub, role: role.data, adminRole: payload.adminRole };
    } catch {
      return null;
    }
  }
}

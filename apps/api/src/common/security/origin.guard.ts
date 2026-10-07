import { resolvePortal } from '@drivetn/types';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { APP_CONFIG } from '../../config/config.constants';
import type { Env } from '../../config/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseOrigin(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Protection CSRF des requêtes qui modifient des données : l'origine déclarée par le
 * navigateur (Origin, à défaut Referer) doit être l'un des portails ou une origine CORS
 * autorisée. Les clients non navigateurs (serveur Next.js, outils) n'envoient pas d'origine.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: Env) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    const declared = request.headers.origin ?? request.headers.referer;
    if (declared === undefined) {
      return true;
    }
    const url = parseOrigin(declared);
    if (url !== null && this.isAllowed(url)) {
      return true;
    }
    throw new ForbiddenException('Origine de la requête non autorisée.');
  }

  private isAllowed(url: URL): boolean {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    return (
      resolvePortal(url.host, this.config.APP_DOMAIN) !== null ||
      this.config.CORS_ORIGINS.includes(url.origin)
    );
  }
}

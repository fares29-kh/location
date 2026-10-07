import { type Portal, resolvePortal } from '@drivetn/types';
import type { Request } from 'express';

/** Contexte réseau d'une requête, transmis aux services (audit, sessions, redirections). */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  /** Hôte public d'origine (derrière Traefik : X-Forwarded-Host), port inclus. */
  host: string | null;
  secure: boolean;
  portal: Portal | null;
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first === undefined || first.length === 0 ? null : first;
}

export function getRequestContext(request: Request, rootDomain: string): RequestContext {
  const host =
    firstHeaderValue(request.headers['x-forwarded-host']) ?? firstHeaderValue(request.headers.host);
  const userAgent = request.headers['user-agent'];
  return {
    ip: request.ip ?? null,
    userAgent: userAgent === undefined ? null : userAgent.slice(0, 512),
    host,
    secure: request.protocol === 'https',
    portal: resolvePortal(host, rootDomain),
  };
}

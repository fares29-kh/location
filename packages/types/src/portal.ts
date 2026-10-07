import { z } from 'zod';

export const PORTALS = ['client', 'agency', 'admin'] as const;

export const portalSchema = z.enum(PORTALS);

export type Portal = z.infer<typeof portalSchema>;

const SUBDOMAIN_TO_PORTAL: Readonly<Record<string, Portal>> = {
  app: 'client',
  agency: 'agency',
  admin: 'admin',
};

const PORTAL_SUBDOMAINS: Record<Portal, string | null> = {
  client: null,
  agency: 'agency',
  admin: 'admin',
};

/**
 * Détermine le portail à partir de l'en-tête Host.
 * `localhost` et `app.localhost` servent le portail client.
 */
export function resolvePortal(host: string | null | undefined, rootDomain: string): Portal | null {
  if (host === null || host === undefined || host.length === 0) {
    return null;
  }
  const hostname = (host.split(':')[0] ?? '').toLowerCase();
  const domain = rootDomain.toLowerCase();

  if (hostname === domain) {
    return 'client';
  }
  if (!hostname.endsWith(`.${domain}`)) {
    return null;
  }
  const subdomain = hostname.slice(0, -(domain.length + 1));
  return SUBDOMAIN_TO_PORTAL[subdomain] ?? null;
}

/**
 * Origine publique d'un portail, construite à partir de la requête courante
 * pour conserver le protocole et le port (ex. `http://agency.localhost:8088`).
 */
export function buildPortalOrigin(
  portal: Portal,
  {
    host,
    rootDomain,
    secure,
  }: { host: string | null | undefined; rootDomain: string; secure: boolean },
): string {
  const port = host?.split(':')[1];
  const subdomain = PORTAL_SUBDOMAINS[portal];
  const hostname = subdomain === null ? rootDomain : `${subdomain}.${rootDomain}`;
  const protocol = secure ? 'https' : 'http';
  return port === undefined || port === ''
    ? `${protocol}://${hostname}`
    : `${protocol}://${hostname}:${port}`;
}

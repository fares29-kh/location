import type { Portal } from '@drivetn/types';

export interface PortalConfig {
  label: string;
  audience: string;
  accent: string;
  accentSoft: string;
}

export const PORTAL_CONFIG: Record<Portal, PortalConfig> = {
  client: {
    label: 'Portail client',
    audience: 'Particuliers, touristes et TRE',
    accent: '#2563EB',
    accentSoft: '#DBEAFE',
  },
  agency: {
    label: 'Portail agence',
    audience: 'Agences de location',
    accent: '#059669',
    accentSoft: '#D1FAE5',
  },
  admin: {
    label: 'Portail administrateur',
    audience: 'Équipe de la plateforme',
    accent: '#7C3AED',
    accentSoft: '#EDE9FE',
  },
};

const SUBDOMAIN_TO_PORTAL: Readonly<Record<string, Portal>> = {
  app: 'client',
  agency: 'agency',
  admin: 'admin',
};

/**
 * Détermine le portail à partir de l'en-tête Host.
 * `localhost` et `app.localhost` servent le portail client.
 */
export function resolvePortal(host: string | null, rootDomain: string): Portal | null {
  if (host === null || host.length === 0) {
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

/** Chemin interne (segment App Router) correspondant à une URL publique du portail. */
export function toPortalPath(portal: Portal, pathname: string): string {
  return pathname === '/' ? `/${portal}` : `/${portal}${pathname}`;
}

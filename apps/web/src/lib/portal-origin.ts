import type { Portal } from '@drivetn/types';
import { headers } from 'next/headers';

import { getServerEnv } from '@/env';
import { buildPortalOrigin } from '@/lib/portal';

/** Origine publique d'un portail pour la requête en cours (liens entre portails). */
export async function getPortalOrigin(portal: Portal): Promise<string> {
  const requestHeaders = await headers();
  return buildPortalOrigin(portal, {
    host: requestHeaders.get('host'),
    rootDomain: getServerEnv().APP_DOMAIN,
    secure: requestHeaders.get('x-forwarded-proto') === 'https',
  });
}

import { type NextRequest, NextResponse } from 'next/server';

import { getServerEnv } from './env';
import { resolvePortal, toPortalPath } from './lib/portal';

export function middleware(request: NextRequest): NextResponse {
  const portal = resolvePortal(request.headers.get('host'), getServerEnv().APP_DOMAIN);
  if (portal === null) {
    return new NextResponse('Portail inconnu', { status: 404 });
  }

  const url = request.nextUrl.clone();
  url.pathname = toPortalPath(portal, url.pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/|api/|healthz|favicon.ico|icon.svg).*)'],
};

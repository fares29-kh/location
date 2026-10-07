import { type NextRequest, NextResponse } from 'next/server';

import { getServerEnv } from './env';
import { LOCALE_HEADER } from './i18n/locale-header';
import { resolveLocaleRoute, resolvePortal, toPortalPath } from './lib/portal';

export function middleware(request: NextRequest): NextResponse {
  const portal = resolvePortal(request.headers.get('host'), getServerEnv().APP_DOMAIN);
  if (portal === null) {
    return new NextResponse('Portail inconnu', { status: 404 });
  }

  const url = request.nextUrl.clone();
  const route = resolveLocaleRoute(url.pathname);
  if (route.type === 'redirect') {
    url.pathname = route.pathname;
    return NextResponse.redirect(url, 308);
  }

  url.pathname = toPortalPath(portal, route.locale, route.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, route.locale);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/|api/|healthz|.*\\..*).*)'],
};

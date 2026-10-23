import { type NextRequest, NextResponse } from 'next/server';

import { getServerEnv } from './env';
import { LOCALE_HEADER } from './i18n/locale-header';
import { resolveMiddlewareSession } from './lib/auth/middleware-session';
import { isProtectedPath } from './lib/auth/routes';
import { localizePath, resolveLocaleRoute, resolvePortal, toPortalPath } from './lib/portal';

function withCookies(response: NextResponse, setCookies: string[]): NextResponse {
  for (const cookie of setCookies) {
    response.headers.append('Set-Cookie', cookie);
  }
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();
  const portal = resolvePortal(request.headers.get('host'), env.APP_DOMAIN);
  if (portal === null) {
    return new NextResponse('Portail inconnu', { status: 404 });
  }

  const url = request.nextUrl.clone();
  const route = resolveLocaleRoute(url.pathname);
  if (route.type === 'redirect') {
    url.pathname = route.pathname;
    return NextResponse.redirect(url, 308);
  }

  const session = await resolveMiddlewareSession(request, env.API_INTERNAL_URL);

  if (portal === 'agency' && route.pathname === '/' && !session.authenticated) {
    const welcome = request.nextUrl.clone();
    welcome.pathname = localizePath(route.locale, '/welcome');
    welcome.search = '';
    return withCookies(NextResponse.redirect(welcome), session.setCookies);
  }

  if (portal === 'agency' && route.pathname === '/welcome' && session.authenticated) {
    const home = request.nextUrl.clone();
    home.pathname = localizePath(route.locale, '/');
    home.search = '';
    return withCookies(NextResponse.redirect(home), session.setCookies);
  }

  if (!session.authenticated && isProtectedPath(portal, route.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = localizePath(route.locale, '/login');
    login.search = '';
    login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  url.pathname = toPortalPath(portal, route.locale, route.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, route.locale);
  if (session.cookieHeader !== null) {
    requestHeaders.set('cookie', session.cookieHeader);
  }
  return withCookies(
    NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
    session.setCookies,
  );
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/|api/|healthz|.*\\..*).*)'],
};

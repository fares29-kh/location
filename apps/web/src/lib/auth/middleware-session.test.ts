import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mergeCookieHeader, parseSetCookie, resolveMiddlewareSession } from './middleware-session';

const API_URL = 'http://api:3001';

function requestWith(cookie?: string): NextRequest {
  const headers = new Headers({ host: 'agency.drivetn.localhost', 'user-agent': 'vitest' });
  if (cookie !== undefined) {
    headers.set('cookie', cookie);
  }
  return new NextRequest('http://agency.drivetn.localhost/', { headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseSetCookie', () => {
  it('extrait le nom et la valeur', () => {
    expect(parseSetCookie('drivetn_at=abc.def; Path=/; HttpOnly')).toEqual({
      name: 'drivetn_at',
      value: 'abc.def',
    });
  });

  it('ignore un en-tête invalide', () => {
    expect(parseSetCookie('=abc')).toBeNull();
    expect(parseSetCookie('')).toBeNull();
  });
});

describe('mergeCookieHeader', () => {
  it('remplace les cookies renouvelés et garde les autres', () => {
    const header = mergeCookieHeader(
      [
        { name: 'theme', value: 'dark' },
        { name: 'drivetn_rt', value: 'old' },
      ],
      ['drivetn_rt=new; Path=/; HttpOnly', 'drivetn_at=token; Path=/; HttpOnly'],
    );
    expect(header).toBe('theme=dark; drivetn_rt=new; drivetn_at=token');
  });
});

describe('resolveMiddlewareSession', () => {
  it('considère la session ouverte si l’access token est présent, sans appel à l’API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const session = await resolveMiddlewareSession(requestWith('drivetn_at=token'), API_URL);
    expect(session).toEqual({ authenticated: true, setCookies: [], cookieHeader: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('est anonyme sans aucun cookie de session', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const session = await resolveMiddlewareSession(requestWith(), API_URL);
    expect(session.authenticated).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renouvelle la session avec le refresh token et transmet les nouveaux cookies', async () => {
    const responseHeaders = new Headers();
    responseHeaders.append('set-cookie', 'drivetn_at=fresh; Path=/; HttpOnly');
    responseHeaders.append('set-cookie', 'drivetn_rt=rotated; Path=/; HttpOnly');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, headers: responseHeaders }));
    vi.stubGlobal('fetch', fetchMock);

    const session = await resolveMiddlewareSession(requestWith('drivetn_rt=refresh'), API_URL);

    expect(session.authenticated).toBe(true);
    expect(session.setCookies).toHaveLength(2);
    expect(session.cookieHeader).toBe('drivetn_rt=rotated; drivetn_at=fresh');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/api/v1/auth/refresh`);
    const sent = new Headers(init.headers);
    expect(sent.get('cookie')).toBe('drivetn_rt=refresh');
    expect(sent.get('x-forwarded-host')).toBe('agency.drivetn.localhost');
    expect(sent.get('user-agent')).toBe('vitest');
  });

  it('reste anonyme si le renouvellement échoue, sans effacer les cookies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const session = await resolveMiddlewareSession(requestWith('drivetn_rt=stale'), API_URL);
    expect(session).toEqual({ authenticated: false, setCookies: [], cookieHeader: null });
  });

  it('reste anonyme si l’API est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const session = await resolveMiddlewareSession(requestWith('drivetn_rt=refresh'), API_URL);
    expect(session.authenticated).toBe(false);
  });
});

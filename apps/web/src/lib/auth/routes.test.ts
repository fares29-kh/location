import { describe, expect, it } from 'vitest';

import { isAuthPage, isProtectedPath, sanitizeNextPath } from './routes';

describe('isAuthPage', () => {
  it('reconnaît les pages d’authentification et leurs sous-chemins', () => {
    expect(isAuthPage('client', '/login')).toBe(true);
    expect(isAuthPage('agency', '/auth/handoff')).toBe(true);
    expect(isAuthPage('client', '/loginx')).toBe(false);
  });

  it('n’expose pas d’inscription sur le portail admin', () => {
    expect(isAuthPage('admin', '/signup')).toBe(false);
    expect(isAuthPage('agency', '/signup')).toBe(true);
  });
});

describe('isProtectedPath', () => {
  it('protège tout l’espace agence et admin sauf les pages d’authentification', () => {
    expect(isProtectedPath('agency', '/')).toBe(true);
    expect(isProtectedPath('agency', '/welcome')).toBe(false);
    expect(isProtectedPath('agency', '/design')).toBe(true);
    expect(isProtectedPath('agency', '/login')).toBe(false);
    expect(isProtectedPath('admin', '/forgot-password')).toBe(false);
    expect(isProtectedPath('admin', '/signup')).toBe(true);
  });

  it('ne protège que l’espace personnel côté client', () => {
    expect(isProtectedPath('client', '/')).toBe(false);
    expect(isProtectedPath('client', '/account')).toBe(true);
    expect(isProtectedPath('client', '/account/bookings')).toBe(true);
    expect(isProtectedPath('client', '/accounting')).toBe(false);
    expect(isProtectedPath('client', '/bookings')).toBe(true);
    expect(isProtectedPath('client', '/search')).toBe(false);
    expect(isProtectedPath('client', '/agencies')).toBe(false);
  });
});

describe('sanitizeNextPath', () => {
  it('garde les chemins relatifs au site', () => {
    expect(sanitizeNextPath('/account')).toBe('/account');
    expect(sanitizeNextPath('/ar/account?tab=profile')).toBe('/ar/account?tab=profile');
  });

  it('rejette les redirections ouvertes et les valeurs absentes', () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath('https://evil.example')).toBeNull();
    expect(sanitizeNextPath('//evil.example')).toBeNull();
    expect(sanitizeNextPath('/\\evil.example')).toBeNull();
    expect(sanitizeNextPath('/\tevil')).toBeNull();
    expect(sanitizeNextPath('account')).toBeNull();
  });
});

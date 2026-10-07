import { describe, expect, it } from 'vitest';

import { resolveLocaleRoute, resolvePortal, toPortalPath } from './portal';

describe('resolvePortal', () => {
  it.each([
    ['localhost', 'client'],
    ['localhost:3000', 'client'],
    ['app.localhost', 'client'],
    ['agency.localhost', 'agency'],
    ['admin.localhost', 'admin'],
    ['ADMIN.LOCALHOST', 'admin'],
  ] as const)('%s => %s', (host, expected) => {
    expect(resolvePortal(host, 'localhost')).toBe(expected);
  });

  it('fonctionne avec un domaine de production', () => {
    expect(resolvePortal('drivetn.tn', 'drivetn.tn')).toBe('client');
    expect(resolvePortal('agency.drivetn.tn', 'drivetn.tn')).toBe('agency');
  });

  it.each([null, '', 'evil.com', 'partner.localhost', 'a.agency.localhost', 'localhost.evil.com'])(
    'refuse l’hôte %s',
    (host) => {
      expect(resolvePortal(host, 'localhost')).toBeNull();
    },
  );
});

describe('resolveLocaleRoute', () => {
  it('sert le français sans préfixe', () => {
    expect(resolveLocaleRoute('/')).toEqual({ type: 'rewrite', locale: 'fr', pathname: '/' });
    expect(resolveLocaleRoute('/voitures/123')).toEqual({
      type: 'rewrite',
      locale: 'fr',
      pathname: '/voitures/123',
    });
  });

  it('extrait les préfixes ar et en', () => {
    expect(resolveLocaleRoute('/ar')).toEqual({ type: 'rewrite', locale: 'ar', pathname: '/' });
    expect(resolveLocaleRoute('/en/design')).toEqual({
      type: 'rewrite',
      locale: 'en',
      pathname: '/design',
    });
  });

  it('redirige le préfixe /fr vers l’URL canonique sans préfixe', () => {
    expect(resolveLocaleRoute('/fr')).toEqual({ type: 'redirect', pathname: '/' });
    expect(resolveLocaleRoute('/fr/design')).toEqual({ type: 'redirect', pathname: '/design' });
  });

  it('ne confond pas un segment qui commence par un code de langue', () => {
    expect(resolveLocaleRoute('/arrivees')).toEqual({
      type: 'rewrite',
      locale: 'fr',
      pathname: '/arrivees',
    });
  });
});

describe('toPortalPath', () => {
  it('réécrit la racine vers les segments portail et langue', () => {
    expect(toPortalPath('agency', 'fr', '/')).toBe('/agency/fr');
  });

  it('préfixe les sous-chemins', () => {
    expect(toPortalPath('client', 'ar', '/voitures/123')).toBe('/client/ar/voitures/123');
  });
});

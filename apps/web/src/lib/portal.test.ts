import { describe, expect, it } from 'vitest';

import { localizePath, resolveLocaleRoute, toPortalPath } from './portal';

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

describe('localizePath', () => {
  it('ne préfixe pas le français', () => {
    expect(localizePath('fr', '/login')).toBe('/login');
  });

  it('préfixe l’arabe et l’anglais', () => {
    expect(localizePath('ar', '/')).toBe('/ar');
    expect(localizePath('en', '/account')).toBe('/en/account');
  });
});

import { describe, expect, it } from 'vitest';

import { buildPortalOrigin, PORTALS, portalSchema, resolvePortal } from './portal';

describe('portalSchema', () => {
  it.each(PORTALS)('accepte le portail %s', (portal) => {
    expect(portalSchema.parse(portal)).toBe(portal);
  });

  it('refuse un portail inconnu', () => {
    expect(portalSchema.safeParse('partner').success).toBe(false);
  });
});

describe('buildPortalOrigin', () => {
  it('conserve le port de la requête', () => {
    expect(
      buildPortalOrigin('agency', {
        host: 'localhost:8088',
        rootDomain: 'localhost',
        secure: false,
      }),
    ).toBe('http://agency.localhost:8088');
  });

  it('sert le portail client sur le domaine racine, en HTTPS', () => {
    expect(
      buildPortalOrigin('client', {
        host: 'admin.drivetn.tn',
        rootDomain: 'drivetn.tn',
        secure: true,
      }),
    ).toBe('https://drivetn.tn');
  });

  it('fonctionne sans en-tête Host', () => {
    expect(buildPortalOrigin('admin', { host: null, rootDomain: 'localhost', secure: false })).toBe(
      'http://admin.localhost',
    );
  });
});

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

  it.each([
    null,
    undefined,
    '',
    'evil.com',
    'partner.localhost',
    'a.agency.localhost',
    'localhost.evil.com',
  ])('refuse l’hôte %s', (host) => {
    expect(resolvePortal(host, 'localhost')).toBeNull();
  });
});

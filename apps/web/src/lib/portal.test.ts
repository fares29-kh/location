import { describe, expect, it } from 'vitest';

import { resolvePortal, toPortalPath } from './portal';

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

describe('toPortalPath', () => {
  it('réécrit la racine vers le segment du portail', () => {
    expect(toPortalPath('agency', '/')).toBe('/agency');
  });

  it('préfixe les sous-chemins', () => {
    expect(toPortalPath('client', '/voitures/123')).toBe('/client/voitures/123');
  });
});

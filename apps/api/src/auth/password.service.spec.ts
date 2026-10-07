import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hache en argon2id et vérifie le bon mot de passe', async () => {
    const hashed = await passwords.hash('voiture2026');
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    await expect(passwords.verify(hashed, 'voiture2026')).resolves.toBe(true);
    await expect(passwords.verify(hashed, 'autre2026')).resolves.toBe(false);
  });

  it('renvoie false pour un hash corrompu au lieu de lever une erreur', async () => {
    await expect(passwords.verify('pas-un-hash', 'x')).resolves.toBe(false);
  });

  it('effectue une vérification factice qui échoue toujours', async () => {
    await expect(passwords.verifyDummy('drivetn-dummy-password')).resolves.toBe(false);
  });
});

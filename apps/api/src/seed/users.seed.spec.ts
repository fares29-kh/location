import { isValidTunisianPhone } from '@drivetn/types';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_PASSWORD, DEMO_USERS, seedDemoUsers } from './users.seed';

function prismaMock(existingEmails: string[]) {
  const create = vi.fn().mockResolvedValue({});
  const findUnique = vi.fn(({ where }: { where: { email: string } }) =>
    Promise.resolve(existingEmails.includes(where.email) ? { id: 'u' } : null),
  );
  const prisma = { user: { findUnique, create } } as unknown as Parameters<typeof seedDemoUsers>[0];
  return { prisma, create };
}

describe('seedDemoUsers', () => {
  it('fournit un compte par rôle avec un téléphone valide', () => {
    expect(DEMO_USERS.map((u) => u.email)).toEqual([
      'admin@demo.tn',
      'support@demo.tn',
      'finance@demo.tn',
      'agency@demo.tn',
      'customer@demo.tn',
    ]);
    expect(DEMO_USERS.filter((u) => u.role === 'ADMIN').map((u) => u.adminRole)).toEqual([
      'SUPER_ADMIN',
      'SUPPORT',
      'FINANCE',
    ]);
    for (const user of DEMO_USERS) {
      expect(isValidTunisianPhone(user.phone)).toBe(true);
    }
  });

  it('crée des comptes actifs, vérifiés, avec un mot de passe haché', async () => {
    const { prisma, create } = prismaMock([]);
    const hash = vi.fn().mockResolvedValue('hashed');

    const created = await seedDemoUsers(prisma, hash);

    expect(created).toBe(DEMO_USERS.length);
    expect(hash).toHaveBeenCalledWith(DEMO_PASSWORD);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { status: 'ACTIVE', passwordHash: 'hashed', phone: '+21620000001' },
    });
  });

  it('ne touche pas aux comptes existants', async () => {
    const { prisma, create } = prismaMock(['admin@demo.tn', 'customer@demo.tn']);

    const created = await seedDemoUsers(prisma, () => Promise.resolve('hashed'));

    expect(created).toBe(DEMO_USERS.length - 2);
    expect(create).toHaveBeenCalledTimes(DEMO_USERS.length - 2);
  });
});

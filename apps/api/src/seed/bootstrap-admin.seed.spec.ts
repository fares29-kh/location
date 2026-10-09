import { describe, expect, it, vi } from 'vitest';

import { parseBootstrapAdmin, seedBootstrapAdmin } from './bootstrap-admin.seed';

const VALID = {
  ADMIN_EMAIL: ' Fares@DriveTN.tn ',
  ADMIN_PHONE: '22 123 456',
  ADMIN_PASSWORD: 'motdepasse2026',
};

describe('parseBootstrapAdmin', () => {
  it('ignore une configuration vide', () => {
    expect(parseBootstrapAdmin({})).toBeNull();
    expect(parseBootstrapAdmin({ ADMIN_EMAIL: '  ', ADMIN_PHONE: '' })).toBeNull();
  });

  it('normalise l’e-mail et le téléphone, avec un nom par défaut', () => {
    expect(parseBootstrapAdmin(VALID)).toEqual({
      email: 'fares@drivetn.tn',
      phone: '+21622123456',
      password: 'motdepasse2026',
      firstName: 'Admin',
      lastName: 'DriveTN',
    });
  });

  it('refuse une configuration incomplète ou invalide en listant les problèmes', () => {
    expect(() => parseBootstrapAdmin({ ADMIN_EMAIL: 'fares@drivetn.tn' })).toThrow(
      /ADMIN_PHONE invalide.*ADMIN_PASSWORD trop faible/,
    );
    expect(() => parseBootstrapAdmin({ ...VALID, ADMIN_EMAIL: 'pas-un-email' })).toThrow(
      /ADMIN_EMAIL invalide/,
    );
    expect(() => parseBootstrapAdmin({ ...VALID, ADMIN_PASSWORD: 'motdepasse' })).toThrow(
      /ADMIN_PASSWORD/,
    );
  });
});

describe('seedBootstrapAdmin', () => {
  const admin = parseBootstrapAdmin(VALID);
  if (admin === null) {
    throw new Error('configuration de test invalide');
  }

  function prismaMock(users: { email?: string; phone?: string }[]) {
    const create = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn(({ where }: { where: { email?: string; phone?: string } }) =>
      Promise.resolve(
        users.find(
          (user) =>
            (where.email !== undefined && user.email === where.email) ||
            (where.phone !== undefined && user.phone === where.phone),
        ) ?? null,
      ),
    );
    const prisma = { user: { findUnique, create } } as unknown as Parameters<
      typeof seedBootstrapAdmin
    >[0];
    return { prisma, create };
  }

  it('crée un super-administrateur actif avec un mot de passe haché', async () => {
    const { prisma, create } = prismaMock([]);
    const hash = vi.fn().mockResolvedValue('hashed');

    await expect(seedBootstrapAdmin(prisma, admin, hash)).resolves.toBe('created');
    expect(hash).toHaveBeenCalledWith('motdepasse2026');
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        role: 'ADMIN',
        adminRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        email: 'fares@drivetn.tn',
        phone: '+21622123456',
        passwordHash: 'hashed',
      },
    });
  });

  it('ne modifie jamais un compte existant', async () => {
    const { prisma, create } = prismaMock([{ email: 'fares@drivetn.tn' }]);

    await expect(seedBootstrapAdmin(prisma, admin, () => Promise.resolve('x'))).resolves.toBe(
      'exists',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('refuse un téléphone déjà utilisé par un autre compte', async () => {
    const { prisma, create } = prismaMock([{ email: 'autre@demo.tn', phone: '+21622123456' }]);

    await expect(seedBootstrapAdmin(prisma, admin, () => Promise.resolve('x'))).rejects.toThrow(
      /appartient déjà/,
    );
    expect(create).not.toHaveBeenCalled();
  });
});

import { toE164 } from '@drivetn/types';
import type { AdminRole, PrismaClient, UserRole } from '@prisma/client';

/** Mot de passe commun des comptes de démo (développement uniquement, documenté dans le README). */
export const DEMO_PASSWORD = 'Demo2026!';

export interface DemoUserSeed {
  email: string;
  phone: string;
  role: UserRole;
  adminRole: AdminRole | null;
  firstName: string;
  lastName: string;
}

export const DEMO_USERS: readonly DemoUserSeed[] = [
  {
    email: 'admin@demo.tn',
    phone: '20000001',
    role: 'ADMIN',
    adminRole: 'SUPER_ADMIN',
    firstName: 'Salma',
    lastName: 'Trabelsi',
  },
  {
    email: 'agency@demo.tn',
    phone: '20000002',
    role: 'AGENCY_OWNER',
    adminRole: null,
    firstName: 'Karim',
    lastName: 'Ben Ali',
  },
  {
    email: 'customer@demo.tn',
    phone: '20000003',
    role: 'CUSTOMER',
    adminRole: null,
    firstName: 'Amira',
    lastName: 'Ben Salah',
  },
];

/** Idempotent : crée les comptes absents, ne modifie jamais un compte existant. */
export async function seedDemoUsers(
  prisma: Pick<PrismaClient, 'user'>,
  hashPassword: (password: string) => Promise<string>,
): Promise<number> {
  let created = 0;
  for (const demo of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: demo.email } });
    if (existing !== null) {
      continue;
    }
    await prisma.user.create({
      data: {
        ...demo,
        phone: toE164(demo.phone),
        status: 'ACTIVE',
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });
    created += 1;
  }
  return created;
}

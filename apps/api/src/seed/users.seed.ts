import { DEMO_PASSWORD, type DemoAccount, getDemoAccounts, toE164 } from '@drivetn/types';
import type { AdminRole, PrismaClient, UserRole } from '@prisma/client';

export { DEMO_PASSWORD };

export interface DemoUserSeed {
  email: string;
  phone: string;
  role: UserRole;
  adminRole: AdminRole | null;
  firstName: string;
  lastName: string;
}

/** Les identifiants viennent de `@drivetn/types`, partagés avec les pages de connexion. */
function credentials(portal: DemoAccount['portal']): Pick<DemoUserSeed, 'email' | 'phone'> {
  const [account] = getDemoAccounts(portal);
  if (account === undefined) {
    throw new Error(`Aucun compte de démo pour le portail ${portal}`);
  }
  return { email: account.email, phone: account.phone };
}

export const DEMO_USERS: readonly DemoUserSeed[] = [
  {
    ...credentials('admin'),
    role: 'ADMIN',
    adminRole: 'SUPER_ADMIN',
    firstName: 'Salma',
    lastName: 'Trabelsi',
  },
  {
    ...credentials('agency'),
    role: 'AGENCY_OWNER',
    adminRole: null,
    firstName: 'Karim',
    lastName: 'Ben Ali',
  },
  {
    ...credentials('client'),
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

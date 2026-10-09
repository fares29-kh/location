import { emailSchema, isValidTunisianPhone, passwordSchema, toE164 } from '@drivetn/types';
import type { PrismaClient } from '@prisma/client';

export interface BootstrapAdmin {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
}

type AdminEnv = Partial<
  Record<
    'ADMIN_EMAIL' | 'ADMIN_PHONE' | 'ADMIN_PASSWORD' | 'ADMIN_FIRST_NAME' | 'ADMIN_LAST_NAME',
    string
  >
>;

/**
 * Lit le compte super-administrateur initial depuis l'environnement.
 * `null` si rien n'est configuré ; lève une erreur si la configuration est incomplète ou invalide.
 */
export function parseBootstrapAdmin(env: AdminEnv): BootstrapAdmin | null {
  const email = env.ADMIN_EMAIL?.trim() ?? '';
  const phone = env.ADMIN_PHONE?.trim() ?? '';
  const password = env.ADMIN_PASSWORD ?? '';
  if (email === '' && phone === '' && password === '') {
    return null;
  }

  const problems: string[] = [];
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    problems.push('ADMIN_EMAIL invalide');
  }
  if (!isValidTunisianPhone(phone)) {
    problems.push('ADMIN_PHONE invalide (numéro tunisien à 8 chiffres)');
  }
  if (!passwordSchema.safeParse(password).success) {
    problems.push('ADMIN_PASSWORD trop faible (8 caractères minimum, lettres et chiffres)');
  }
  if (problems.length > 0 || !parsedEmail.success) {
    throw new Error(`Compte administrateur initial : ${problems.join(' ; ')}.`);
  }

  return {
    email: parsedEmail.data,
    phone: toE164(phone),
    password,
    firstName: nonEmpty(env.ADMIN_FIRST_NAME, 'Admin'),
    lastName: nonEmpty(env.ADMIN_LAST_NAME, 'DriveTN'),
  };
}

/** Docker Compose transmet une chaîne vide pour une variable non renseignée. */
function nonEmpty(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? fallback : trimmed;
}

/** Idempotent : crée le compte s'il n'existe pas, ne modifie jamais un compte existant. */
export async function seedBootstrapAdmin(
  prisma: Pick<PrismaClient, 'user'>,
  admin: BootstrapAdmin,
  hashPassword: (password: string) => Promise<string>,
): Promise<'created' | 'exists'> {
  const existing = await prisma.user.findUnique({ where: { email: admin.email } });
  if (existing !== null) {
    return 'exists';
  }
  const phoneOwner = await prisma.user.findUnique({ where: { phone: admin.phone } });
  if (phoneOwner !== null) {
    throw new Error(
      `Compte administrateur initial : le téléphone ${admin.phone} appartient déjà à un autre compte.`,
    );
  }
  await prisma.user.create({
    data: {
      role: 'ADMIN',
      adminRole: 'SUPER_ADMIN',
      email: admin.email,
      phone: admin.phone,
      firstName: admin.firstName,
      lastName: admin.lastName,
      status: 'ACTIVE',
      phoneVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(admin.password),
    },
  });
  return 'created';
}

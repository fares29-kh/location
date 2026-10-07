import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { PasswordService } from '../auth/password.service';
import { seedGovernorates } from './governorates.seed';
import { seedLocations } from './locations.seed';
import { seedPlatformSettings } from './platform-settings.seed';
import { DEMO_USERS, seedDemoUsers } from './users.seed';

async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const prisma = new PrismaClient();
  try {
    const settings = await seedPlatformSettings(prisma);
    logger.log(`Paramètres plateforme : ${settings} vérifiés`);

    const governorates = await seedGovernorates(prisma);
    const locations = await seedLocations(prisma);
    logger.log(`Géographie : ${governorates} gouvernorats, ${locations} lieux`);

    if (process.env.SEED_DEMO_ACCOUNTS === 'true') {
      if (process.env.NODE_ENV === 'production') {
        logger.warn(
          'SEED_DEMO_ACCOUNTS=true en production : comptes de démo à mot de passe connu !',
        );
      }
      const passwords = new PasswordService();
      const created = await seedDemoUsers(prisma, (password) => passwords.hash(password));
      logger.log(`Comptes de démo : ${created} créés sur ${DEMO_USERS.length}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  new Logger('Seed').error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});

import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { seedPlatformSettings } from './platform-settings.seed';

async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const prisma = new PrismaClient();
  try {
    const settings = await seedPlatformSettings(prisma);
    logger.log(`Paramètres plateforme : ${settings} vérifiés`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  new Logger('Seed').error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});

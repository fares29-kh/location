import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { PasswordService } from '../auth/password.service';
import { seedAdminDemo } from './admin.seed';
import { seedDemoAgency } from './agency.seed';
import { parseBootstrapAdmin, seedBootstrapAdmin } from './bootstrap-admin.seed';
import { seedGovernorates } from './governorates.seed';
import { seedLocations } from './locations.seed';
import { seedPlatformSettings } from './platform-settings.seed';
import { DEMO_USERS, seedDemoUsers } from './users.seed';
import { syncVehicleModels } from './vehicle-models.seed';

async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const prisma = new PrismaClient();
  try {
    const settings = await seedPlatformSettings(prisma);
    logger.log(`Paramètres plateforme : ${settings} vérifiés`);

    const governorates = await seedGovernorates(prisma);
    const locations = await seedLocations(prisma);
    logger.log(`Géographie : ${governorates} gouvernorats, ${locations} lieux`);

    const bootstrapAdmin = parseBootstrapAdmin(process.env);
    if (bootstrapAdmin === null) {
      logger.log('Compte administrateur initial : non configuré (ADMIN_EMAIL vide)');
    } else {
      const passwords = new PasswordService();
      const result = await seedBootstrapAdmin(prisma, bootstrapAdmin, (password) =>
        passwords.hash(password),
      );
      logger.log(
        result === 'created'
          ? `Compte administrateur initial créé : ${bootstrapAdmin.email}`
          : `Compte administrateur initial déjà présent : ${bootstrapAdmin.email}`,
      );
    }

    if (process.env.SEED_DEMO_ACCOUNTS === 'true') {
      if (process.env.NODE_ENV === 'production') {
        logger.warn(
          'SEED_DEMO_ACCOUNTS=true en production : comptes de démo à mot de passe connu !',
        );
      }
      const passwords = new PasswordService();
      const created = await seedDemoUsers(prisma, (password) => passwords.hash(password));
      logger.log(`Comptes de démo : ${created} créés sur ${DEMO_USERS.length}`);

      const agency = await seedDemoAgency(prisma);
      if (agency.created) {
        logger.log(
          `Agence de démo : ${agency.vehicles} véhicules, ${agency.bookings} réservations`,
        );
      }

      const admin = await seedAdminDemo(prisma);
      if (admin.created) {
        logger.log(
          `Administration : ${admin.agencies} agences partenaires, ${admin.bookings} réservations, ${admin.invoices} factures`,
        );
      }
    }

    const models = await syncVehicleModels(prisma);
    if (models > 0) {
      logger.log(`Modèles de véhicules : ${models} ajoutés depuis la flotte`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  new Logger('Seed').error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});

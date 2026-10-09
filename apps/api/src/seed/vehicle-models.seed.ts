import type { PrismaClient } from '@prisma/client';

/**
 * Ajoute au référentiel les couples marque / modèle des véhicules existants (jeux de démo
 * créés après la migration). Ne touche pas aux modèles déjà présents.
 */
export function syncVehicleModels(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO "vehicle_models" ("id", "brand_id", "name", "updated_at")
    SELECT 'vm_' || substr(md5(b."name" || '/' || v."model"), 1, 22), b."id", v."model", CURRENT_TIMESTAMP
    FROM (SELECT DISTINCT "brand", "model" FROM "vehicles") AS v
    JOIN "vehicle_brands" b ON b."name" = v."brand"
    ON CONFLICT DO NOTHING`;
}

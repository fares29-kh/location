import type { Prisma, PrismaClient } from '@prisma/client';

/** Identifiant d'une catégorie du référentiel (créé par la migration) à partir de son slug. */
export async function categoryIdsBySlug(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<(slug: string) => string> {
  const rows = await db.vehicleCategory.findMany({ select: { id: true, slug: true } });
  const ids = new Map(rows.map((row) => [row.slug, row.id]));
  return (slug) => {
    const id = ids.get(slug);
    if (id === undefined) {
      throw new Error(`Catégorie de véhicule inconnue : ${slug}`);
    }
    return id;
  };
}

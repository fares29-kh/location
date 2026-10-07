import type { PrismaClient } from '@prisma/client';

export interface GovernorateSeed {
  code: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
}

/** Les 24 gouvernorats, avec leur code officiel INS. */
export const GOVERNORATES: readonly GovernorateSeed[] = [
  { code: '11', slug: 'tunis', nameFr: 'Tunis', nameAr: 'تونس', nameEn: 'Tunis' },
  { code: '12', slug: 'ariana', nameFr: 'Ariana', nameAr: 'أريانة', nameEn: 'Ariana' },
  { code: '13', slug: 'ben-arous', nameFr: 'Ben Arous', nameAr: 'بن عروس', nameEn: 'Ben Arous' },
  { code: '14', slug: 'manouba', nameFr: 'La Manouba', nameAr: 'منوبة', nameEn: 'Manouba' },
  { code: '21', slug: 'nabeul', nameFr: 'Nabeul', nameAr: 'نابل', nameEn: 'Nabeul' },
  { code: '22', slug: 'zaghouan', nameFr: 'Zaghouan', nameAr: 'زغوان', nameEn: 'Zaghouan' },
  { code: '23', slug: 'bizerte', nameFr: 'Bizerte', nameAr: 'بنزرت', nameEn: 'Bizerte' },
  { code: '31', slug: 'beja', nameFr: 'Béja', nameAr: 'باجة', nameEn: 'Beja' },
  { code: '32', slug: 'jendouba', nameFr: 'Jendouba', nameAr: 'جندوبة', nameEn: 'Jendouba' },
  { code: '33', slug: 'le-kef', nameFr: 'Le Kef', nameAr: 'الكاف', nameEn: 'Kef' },
  { code: '34', slug: 'siliana', nameFr: 'Siliana', nameAr: 'سليانة', nameEn: 'Siliana' },
  { code: '41', slug: 'kairouan', nameFr: 'Kairouan', nameAr: 'القيروان', nameEn: 'Kairouan' },
  { code: '42', slug: 'kasserine', nameFr: 'Kasserine', nameAr: 'القصرين', nameEn: 'Kasserine' },
  {
    code: '43',
    slug: 'sidi-bouzid',
    nameFr: 'Sidi Bouzid',
    nameAr: 'سيدي بوزيد',
    nameEn: 'Sidi Bouzid',
  },
  { code: '51', slug: 'sousse', nameFr: 'Sousse', nameAr: 'سوسة', nameEn: 'Sousse' },
  { code: '52', slug: 'monastir', nameFr: 'Monastir', nameAr: 'المنستير', nameEn: 'Monastir' },
  { code: '53', slug: 'mahdia', nameFr: 'Mahdia', nameAr: 'المهدية', nameEn: 'Mahdia' },
  { code: '61', slug: 'sfax', nameFr: 'Sfax', nameAr: 'صفاقس', nameEn: 'Sfax' },
  { code: '71', slug: 'gafsa', nameFr: 'Gafsa', nameAr: 'قفصة', nameEn: 'Gafsa' },
  { code: '72', slug: 'tozeur', nameFr: 'Tozeur', nameAr: 'توزر', nameEn: 'Tozeur' },
  { code: '73', slug: 'kebili', nameFr: 'Kébili', nameAr: 'قبلي', nameEn: 'Kebili' },
  { code: '81', slug: 'gabes', nameFr: 'Gabès', nameAr: 'قابس', nameEn: 'Gabes' },
  { code: '82', slug: 'medenine', nameFr: 'Médenine', nameAr: 'مدنين', nameEn: 'Medenine' },
  { code: '83', slug: 'tataouine', nameFr: 'Tataouine', nameAr: 'تطاوين', nameEn: 'Tataouine' },
];

/** Idempotent : met à jour les libellés, ne supprime rien. */
export async function seedGovernorates(prisma: Pick<PrismaClient, 'governorate'>): Promise<number> {
  for (const governorate of GOVERNORATES) {
    const { code, ...labels } = governorate;
    await prisma.governorate.upsert({
      where: { code },
      create: governorate,
      update: labels,
    });
  }
  return GOVERNORATES.length;
}

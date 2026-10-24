import type { LocationType } from '@drivetn/types';
import type { PrismaClient } from '@prisma/client';

export interface LocationSeed {
  slug: string;
  type: LocationType;
  governorateCode: string;
  iataCode?: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  latitude: number;
  longitude: number;
}

export const AIRPORTS: readonly LocationSeed[] = [
  {
    slug: 'aeroport-tunis-carthage',
    type: 'AIRPORT',
    governorateCode: '11',
    iataCode: 'TUN',
    nameFr: 'Aéroport Tunis-Carthage',
    nameAr: 'مطار تونس قرطاج الدولي',
    nameEn: 'Tunis-Carthage Airport',
    latitude: 36.851,
    longitude: 10.2272,
  },
  {
    slug: 'aeroport-enfidha-hammamet',
    type: 'AIRPORT',
    governorateCode: '51',
    iataCode: 'NBE',
    nameFr: 'Aéroport Enfidha-Hammamet',
    nameAr: 'مطار النفيضة الحمامات الدولي',
    nameEn: 'Enfidha-Hammamet Airport',
    latitude: 36.0758,
    longitude: 10.4386,
  },
  {
    slug: 'aeroport-monastir',
    type: 'AIRPORT',
    governorateCode: '52',
    iataCode: 'MIR',
    nameFr: 'Aéroport Monastir Habib-Bourguiba',
    nameAr: 'مطار المنستير الحبيب بورقيبة الدولي',
    nameEn: 'Monastir Habib Bourguiba Airport',
    latitude: 35.7581,
    longitude: 10.7547,
  },
  {
    slug: 'aeroport-djerba-zarzis',
    type: 'AIRPORT',
    governorateCode: '82',
    iataCode: 'DJE',
    nameFr: 'Aéroport Djerba-Zarzis',
    nameAr: 'مطار جربة جرجيس الدولي',
    nameEn: 'Djerba-Zarzis Airport',
    latitude: 33.875,
    longitude: 10.7755,
  },
  {
    slug: 'aeroport-sfax-thyna',
    type: 'AIRPORT',
    governorateCode: '61',
    iataCode: 'SFA',
    nameFr: 'Aéroport Sfax-Thyna',
    nameAr: 'مطار صفاقس طينة الدولي',
    nameEn: 'Sfax-Thyna Airport',
    latitude: 34.718,
    longitude: 10.691,
  },
  {
    slug: 'aeroport-tozeur-nefta',
    type: 'AIRPORT',
    governorateCode: '72',
    iataCode: 'TOE',
    nameFr: 'Aéroport Tozeur-Nefta',
    nameAr: 'مطار توزر نفطة الدولي',
    nameEn: 'Tozeur-Nefta Airport',
    latitude: 33.9397,
    longitude: 8.1106,
  },
  {
    slug: 'aeroport-tabarka-ain-draham',
    type: 'AIRPORT',
    governorateCode: '32',
    iataCode: 'TBJ',
    nameFr: 'Aéroport Tabarka-Aïn Draham',
    nameAr: 'مطار طبرقة عين دراهم الدولي',
    nameEn: 'Tabarka-Ain Draham Airport',
    latitude: 36.98,
    longitude: 8.8769,
  },
  {
    slug: 'aeroport-gafsa-ksar',
    type: 'AIRPORT',
    governorateCode: '71',
    iataCode: 'GAF',
    nameFr: 'Aéroport Gafsa-Ksar',
    nameAr: 'مطار قفصة القصر الدولي',
    nameEn: 'Gafsa-Ksar Airport',
    latitude: 34.422,
    longitude: 8.8225,
  },
  {
    slug: 'aeroport-gabes-matmata',
    type: 'AIRPORT',
    governorateCode: '81',
    iataCode: 'GAE',
    nameFr: 'Aéroport Gabès-Matmata',
    nameAr: 'مطار قابس مطماطة الدولي',
    nameEn: 'Gabes-Matmata Airport',
    latitude: 33.7331,
    longitude: 9.9188,
  },
];

type CitySeed = [
  slug: string,
  governorateCode: string,
  nameFr: string,
  nameAr: string,
  nameEn: string,
  latitude: number,
  longitude: number,
];

const CITY_ROWS: readonly CitySeed[] = [
  ['tunis', '11', 'Tunis centre', 'تونس العاصمة', 'Tunis city centre', 36.8008, 10.18],
  ['la-marsa', '11', 'La Marsa', 'المرسى', 'La Marsa', 36.8782, 10.3247],
  ['carthage', '11', 'Carthage', 'قرطاج', 'Carthage', 36.8528, 10.3233],
  ['ariana', '12', 'Ariana', 'أريانة', 'Ariana', 36.8625, 10.1956],
  ['ben-arous', '13', 'Ben Arous', 'بن عروس', 'Ben Arous', 36.7531, 10.2189],
  ['manouba', '14', 'La Manouba', 'منوبة', 'Manouba', 36.8101, 10.0956],
  ['nabeul', '21', 'Nabeul', 'نابل', 'Nabeul', 36.4561, 10.7376],
  ['hammamet', '21', 'Hammamet', 'الحمامات', 'Hammamet', 36.4, 10.6167],
  ['kelibia', '21', 'Kélibia', 'قليبية', 'Kelibia', 36.8476, 11.0939],
  ['zaghouan', '22', 'Zaghouan', 'زغوان', 'Zaghouan', 36.4029, 10.1429],
  ['bizerte', '23', 'Bizerte', 'بنزرت', 'Bizerte', 37.2744, 9.8739],
  ['beja', '31', 'Béja', 'باجة', 'Beja', 36.7256, 9.1817],
  ['jendouba', '32', 'Jendouba', 'جندوبة', 'Jendouba', 36.5011, 8.7802],
  ['tabarka', '32', 'Tabarka', 'طبرقة', 'Tabarka', 36.9544, 8.758],
  ['le-kef', '33', 'Le Kef', 'الكاف', 'Kef', 36.1826, 8.7148],
  ['siliana', '34', 'Siliana', 'سليانة', 'Siliana', 36.0849, 9.3708],
  ['kairouan', '41', 'Kairouan', 'القيروان', 'Kairouan', 35.6781, 10.0963],
  ['kasserine', '42', 'Kasserine', 'القصرين', 'Kasserine', 35.1676, 8.8365],
  ['sidi-bouzid', '43', 'Sidi Bouzid', 'سيدي بوزيد', 'Sidi Bouzid', 35.0382, 9.4849],
  ['sousse', '51', 'Sousse', 'سوسة', 'Sousse', 35.8256, 10.636],
  ['port-el-kantaoui', '51', 'Port El Kantaoui', 'القنطاوي', 'Port El Kantaoui', 35.892, 10.595],
  ['monastir', '52', 'Monastir', 'المنستير', 'Monastir', 35.7643, 10.8113],
  ['bouhjar', '52', 'Bouhjar', 'بوحجر', 'Bouhjar', 35.683, 10.883],
  ['mahdia', '53', 'Mahdia', 'المهدية', 'Mahdia', 35.5047, 11.0622],
  ['sfax', '61', 'Sfax', 'صفاقس', 'Sfax', 34.7406, 10.7603],
  ['gafsa', '71', 'Gafsa', 'قفصة', 'Gafsa', 34.425, 8.7842],
  ['tozeur', '72', 'Tozeur', 'توزر', 'Tozeur', 33.9197, 8.1335],
  ['kebili', '73', 'Kébili', 'قبلي', 'Kebili', 33.7044, 8.969],
  ['douz', '73', 'Douz', 'دوز', 'Douz', 33.457, 9.02],
  ['gabes', '81', 'Gabès', 'قابس', 'Gabes', 33.8815, 10.0982],
  ['medenine', '82', 'Médenine', 'مدنين', 'Medenine', 33.3549, 10.5055],
  [
    'djerba-houmt-souk',
    '82',
    'Djerba Houmt Souk',
    'جربة حومة السوق',
    'Djerba Houmt Souk',
    33.875,
    10.8575,
  ],
  ['zarzis', '82', 'Zarzis', 'جرجيس', 'Zarzis', 33.5039, 11.1122],
  ['tataouine', '83', 'Tataouine', 'تطاوين', 'Tataouine', 32.9297, 10.4518],
];

export const CITIES: readonly LocationSeed[] = CITY_ROWS.map(
  ([slug, governorateCode, nameFr, nameAr, nameEn, latitude, longitude]) => ({
    slug,
    type: 'CITY',
    governorateCode,
    nameFr,
    nameAr,
    nameEn,
    latitude,
    longitude,
  }),
);

export const STATIONS_AND_PORTS: readonly LocationSeed[] = [
  {
    slug: 'gare-de-tunis',
    type: 'TRAIN_STATION',
    governorateCode: '11',
    nameFr: 'Gare de Tunis (place Barcelone)',
    nameAr: 'محطة تونس برشلونة',
    nameEn: 'Tunis railway station',
    latitude: 36.7955,
    longitude: 10.1806,
  },
  {
    slug: 'gare-de-sousse',
    type: 'TRAIN_STATION',
    governorateCode: '51',
    nameFr: 'Gare de Sousse',
    nameAr: 'محطة سوسة',
    nameEn: 'Sousse railway station',
    latitude: 35.829,
    longitude: 10.638,
  },
  {
    slug: 'gare-de-sfax',
    type: 'TRAIN_STATION',
    governorateCode: '61',
    nameFr: 'Gare de Sfax',
    nameAr: 'محطة صفاقس',
    nameEn: 'Sfax railway station',
    latitude: 34.737,
    longitude: 10.759,
  },
  {
    slug: 'port-de-la-goulette',
    type: 'PORT',
    governorateCode: '11',
    nameFr: 'Port de La Goulette',
    nameAr: 'ميناء حلق الوادي',
    nameEn: 'La Goulette ferry port',
    latitude: 36.8183,
    longitude: 10.305,
  },
  {
    slug: 'port-de-zarzis',
    type: 'PORT',
    governorateCode: '82',
    nameFr: 'Port de Zarzis',
    nameAr: 'ميناء جرجيس',
    nameEn: 'Zarzis port',
    latitude: 33.49,
    longitude: 11.12,
  },
];

export const LOCATIONS: readonly LocationSeed[] = [...AIRPORTS, ...CITIES, ...STATIONS_AND_PORTS];

type PlaceLinkClient = Pick<PrismaClient, 'location' | 'vehiclePickupLocation'>;

/** Relie une voiture aux lieux actifs dont le slug est donné. */
export async function linkVehiclePlaces(
  prisma: PlaceLinkClient,
  vehicleId: string,
  slugs: readonly string[],
): Promise<void> {
  if (slugs.length === 0) {
    return;
  }
  const locations = await prisma.location.findMany({
    where: { slug: { in: [...slugs] }, isActive: true },
    select: { id: true },
  });
  if (locations.length === 0) {
    return;
  }
  await prisma.vehiclePickupLocation.createMany({
    data: locations.map((location) => ({ vehicleId, locationId: location.id })),
    skipDuplicates: true,
  });
}

/** Relie une voiture à tous les lieux actifs d'un gouvernorat. */
export async function linkVehicleGovernorate(
  prisma: PlaceLinkClient,
  vehicleId: string,
  governorateCode: string,
): Promise<void> {
  const locations = await prisma.location.findMany({
    where: { governorateCode, isActive: true },
    select: { slug: true },
  });
  await linkVehiclePlaces(
    prisma,
    vehicleId,
    locations.map((location) => location.slug),
  );
}

/** Idempotent : met à jour les données de référence sans toucher à l'activation (`isActive`). */
export async function seedLocations(prisma: Pick<PrismaClient, 'location'>): Promise<number> {
  for (const location of LOCATIONS) {
    const { slug, ...rest } = location;
    const data = { ...rest, iataCode: rest.iataCode ?? null };
    await prisma.location.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
  }
  return LOCATIONS.length;
}

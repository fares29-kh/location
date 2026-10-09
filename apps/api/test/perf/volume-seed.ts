import {
  type BookingStatus,
  createRandom,
  type PaymentKind,
  type PaymentMethod,
  type Random,
  rentalDays,
  rentalPriceMillimes,
  toE164,
} from '@drivetn/types';
import type { Prisma, PrismaClient } from '@prisma/client';

import {
  categoryId,
  createOwner,
  GOVERNORATE_CODE,
  resetDatabase,
} from '../support/agency-fixtures';

export interface VolumeOptions {
  /** Agence mesurée. */
  bookings: number;
  vehicles: number;
  customers: number;
  /** Autres agences (bruit de fond partageant les mêmes tables). */
  otherAgencies: number;
  otherBookings: number;
  now: Date;
}

export interface VolumeResult {
  ownerId: string;
  agencyId: string;
  rows: Record<string, number>;
}

export const PERF_AGENCY_ID = 'perf_agency';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const CHUNK = 5_000;

const MODELS: readonly (readonly [string, string, string, number])[] = [
  ['Kia', 'Picanto', 'city', 70],
  ['Hyundai', 'Grand i10', 'city', 75],
  ['Renault', 'Clio 5', 'compact', 95],
  ['Peugeot', '208', 'compact', 110],
  ['Dacia', 'Logan', 'sedan', 85],
  ['Hyundai', 'Accent', 'sedan', 120],
  ['Dacia', 'Duster', 'suv', 150],
  ['Peugeot', '3008', 'suv', 230],
  ['Dacia', 'Jogger', 'family', 160],
  ['Mercedes-Benz', 'Classe C', 'premium', 340],
];
const FIRST_NAMES = ['Amira', 'Mohamed', 'Yassine', 'Sarra', 'Ahmed', 'Nour', 'Skander', 'Ines'];
const LAST_NAMES = ['Ben Salah', 'Trabelsi', 'Jaziri', 'Gharbi', 'Hammami', 'Mejri', 'Ayari'];
const CITIES = ['Tunis', 'Ariana', 'La Marsa', 'Sousse', 'Sfax', 'Nabeul'];
const PLACE = {
  fr: 'Aéroport Tunis-Carthage',
  ar: 'مطار تونس قرطاج',
  en: 'Tunis-Carthage Airport',
};
const METHODS: readonly (readonly [PaymentMethod, number])[] = [
  ['CASH', 50],
  ['CARD_TPE', 30],
  ['BANK_TRANSFER', 20],
];

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let start = 0; start < rows.length; start += CHUNK) {
    await insert(rows.slice(start, start + CHUNK));
  }
}

interface Rows {
  bookings: Prisma.BookingCreateManyInput[];
  events: Prisma.BookingEventCreateManyInput[];
  payments: Prisma.PaymentCreateManyInput[];
  reviews: Prisma.ReviewCreateManyInput[];
}

function statusAt(random: Random, pickupAt: number, returnAt: number, now: number): BookingStatus {
  if (returnAt <= now) {
    return random.weighted<BookingStatus>([
      ['COMPLETED', 85],
      ['CANCELLED', 6],
      ['REJECTED', 4],
      ['EXPIRED', 3],
      ['NO_SHOW', 2],
    ]);
  }
  if (pickupAt <= now) {
    return 'PICKED_UP';
  }
  return random.chance(0.15) ? 'PENDING' : 'CONFIRMED';
}

/** Locations successives sans chevauchement par véhicule, se terminant ~60 jours après `now`. */
function generateBookings(
  random: Random,
  tag: string,
  agencyId: string,
  ownerId: string,
  vehicles: readonly { id: string; dailyRateMillimes: number }[],
  customerIds: readonly string[],
  count: number,
  now: number,
): Rows {
  const rows: Rows = { bookings: [], events: [], payments: [], reviews: [] };
  const perVehicle = Math.ceil(count / vehicles.length);
  for (const vehicle of vehicles) {
    let cursor = now + 60 * DAY_MS - perVehicle * 6 * DAY_MS;
    for (let index = 0; index < perVehicle && rows.bookings.length < count; index += 1) {
      const pickupAt = cursor + random.int(0, 2) * DAY_MS + random.int(8, 18) * HOUR_MS;
      const returnAt = pickupAt + random.int(1, 7) * DAY_MS;
      cursor = returnAt + DAY_MS;
      const status = statusAt(random, pickupAt, returnAt, now);
      const id = `${tag}_b${String(rows.bookings.length).padStart(7, '0')}`;
      const customerId = random.pick(customerIds);
      const total = rentalPriceMillimes(
        vehicle.dailyRateMillimes,
        rentalDays(new Date(pickupAt), new Date(returnAt)),
      );
      const createdAt =
        status === 'PENDING'
          ? now - random.int(1, 30) * HOUR_MS
          : pickupAt - random.int(1, 20) * DAY_MS;
      rows.bookings.push({
        id,
        reference: `${tag.toUpperCase()}-${String(rows.bookings.length).padStart(7, '0')}`,
        agencyId,
        vehicleId: vehicle.id,
        customerId,
        pickupAt: new Date(pickupAt),
        returnAt: new Date(returnAt),
        pickupPlace: PLACE,
        returnPlace: PLACE,
        status,
        dailyRateMillimes: vehicle.dailyRateMillimes,
        totalMillimes: total,
        depositMillimes: 500_000,
        createdAt: new Date(createdAt),
      });
      rows.events.push({
        id: `${id}_e0`,
        bookingId: id,
        status: 'PENDING',
        createdAt: new Date(createdAt),
      });
      if (status !== 'PENDING') {
        rows.events.push({
          id: `${id}_e1`,
          bookingId: id,
          status,
          createdAt: new Date(Math.min(now, Math.max(createdAt, pickupAt))),
        });
      }
      const pay = (suffix: string, kind: PaymentKind, amount: number, at: number) => {
        if (at <= now) {
          rows.payments.push({
            id: `${id}_${suffix}`,
            bookingId: id,
            kind,
            method: random.weighted(METHODS),
            amountMillimes: amount,
            recordedById: ownerId,
            recordedAt: new Date(at),
          });
        }
      };
      if (status === 'COMPLETED' || status === 'PICKED_UP') {
        pay('p0', 'RENTAL', random.chance(0.8) ? total : Math.round(total / 2), pickupAt);
        pay('p1', 'DEPOSIT_HELD', 500_000, pickupAt);
      }
      if (status === 'COMPLETED') {
        pay('p2', 'DEPOSIT_RETURNED', 500_000, returnAt);
        if (random.chance(0.3)) {
          rows.reviews.push({
            id: `${id}_r`,
            bookingId: id,
            agencyId,
            customerId,
            rating: random.weighted([
              [5, 55],
              [4, 28],
              [3, 10],
              [2, 5],
              [1, 2],
            ]),
            comment: 'Très bonne location.',
            reply: random.chance(0.5) ? 'Merci !' : null,
            createdAt: new Date(Math.min(now, returnAt + DAY_MS)),
          });
        }
      }
    }
  }
  return rows;
}

async function seedOne(
  prisma: PrismaClient,
  random: Random,
  tag: string,
  phoneBase: number,
  options: { bookings: number; vehicles: number; customers: number; now: Date },
): Promise<VolumeResult> {
  const ownerId = await createOwner(prisma, tag, String(phoneBase));
  const agency = await prisma.agency.create({
    data: {
      id: `${tag}_agency`,
      ownerId,
      status: 'ACTIVE',
      name: `Agence ${tag}`,
      phone: '71000000',
      whatsappPhone: '98000000',
      address: 'Tunis',
      governorateCode: GOVERNORATE_CODE,
    },
    select: { id: true },
  });

  const customers: Prisma.UserCreateManyInput[] = Array.from(
    { length: options.customers },
    (_, index) => ({
      id: `${tag}_c${String(index).padStart(6, '0')}`,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      firstName: random.pick(FIRST_NAMES),
      lastName: random.pick(LAST_NAMES),
      phone: toE164(String(phoneBase + 1 + index)),
      city: random.pick(CITIES),
      createdAt: new Date(options.now.getTime() - random.int(30, 900) * DAY_MS),
    }),
  );
  await insertChunks(customers, (chunk) => prisma.user.createMany({ data: chunk }));

  const vehicles = Array.from({ length: options.vehicles }, (_, index) => {
    const [brand, model, category, rate] = random.pick(MODELS);
    return {
      id: `${tag}_v${String(index).padStart(5, '0')}`,
      agencyId: agency.id,
      brand,
      model,
      year: random.int(2019, 2025),
      plateNumber: `${String(100 + (index % 150))} TU ${String(1000 + index)}`,
      categoryId: categoryId(category),
      transmission: random.chance(0.7) ? ('MANUAL' as const) : ('AUTOMATIC' as const),
      fuel: random.chance(0.6) ? ('PETROL' as const) : ('DIESEL' as const),
      seats: 5,
      airConditioning: true,
      dailyRateMillimes: rate * 1000,
      depositMillimes: 500_000,
      status: index % 25 === 0 ? ('MAINTENANCE' as const) : ('ACTIVE' as const),
      color: '#2563EB',
    };
  });
  await insertChunks(vehicles, (chunk) => prisma.vehicle.createMany({ data: chunk }));

  const rows = generateBookings(
    random,
    tag,
    agency.id,
    ownerId,
    vehicles,
    customers.map((customer) => customer.id ?? ''),
    options.bookings,
    options.now.getTime(),
  );
  await insertChunks(rows.bookings, (chunk) => prisma.booking.createMany({ data: chunk }));
  await insertChunks(rows.events, (chunk) => prisma.bookingEvent.createMany({ data: chunk }));
  await insertChunks(rows.payments, (chunk) => prisma.payment.createMany({ data: chunk }));
  await insertChunks(rows.reviews, (chunk) => prisma.review.createMany({ data: chunk }));

  return {
    ownerId,
    agencyId: agency.id,
    rows: {
      customers: customers.length,
      vehicles: vehicles.length,
      bookings: rows.bookings.length,
      events: rows.events.length,
      payments: rows.payments.length,
      reviews: rows.reviews.length,
    },
  };
}

/** Vide la base puis insère l'agence mesurée et les agences de bruit de fond. */
export async function seedVolume(
  prisma: PrismaClient,
  options: VolumeOptions,
): Promise<VolumeResult> {
  await resetDatabase(prisma);
  const random = createRandom(20_261_008);
  const target = await seedOne(prisma, random, 'perf', 20_000_000, options);
  for (let index = 0; index < options.otherAgencies; index += 1) {
    await seedOne(prisma, random, `other${String(index)}`, 50_000_000 + index * 100_000, {
      bookings: options.otherBookings,
      vehicles: Math.max(1, Math.round(options.otherBookings / 60)),
      customers: Math.max(1, Math.round(options.otherBookings / 4)),
      now: options.now,
    });
  }
  await prisma.$executeRawUnsafe('ANALYZE');
  return target;
}

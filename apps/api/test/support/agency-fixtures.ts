import {
  type AgencyDataset,
  type AgencyQueries,
  type BookingStatus,
  createAgencyDataset,
  createAgencyQueries,
  type Customer,
  type Review,
  toE164,
} from '@drivetn/types';
import type { Prisma, PrismaClient } from '@prisma/client';

import {
  toCustomer,
  toPayment,
  toPlace,
  toSettings,
  toVehicle,
} from '../../src/agency/agency.mapper';
import { CUSTOMER_SELECT } from '../../src/agency/agency.queries';
import { VEHICLE_PHOTOS_INCLUDE } from '../../src/storage/vehicle-photos';

export const GOVERNORATE_CODE = '11';
export const MEDIA_URL = 'http://media.test';

export const publicUrl = (key: string): string => `${MEDIA_URL}/${key}`;

/** Identifiant d'une des six catégories créées par la migration `admin_catalog_geography`. */
export function categoryId(slug: string): string {
  return `vcat_${slug}`;
}

/** Vide toutes les tables métier (les gouvernorats sont conservés). */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE audit_logs, review_reports, reviews, payments, booking_events, bookings,
      vehicle_photos, vehicles, agency_documents, invoices, agencies, refresh_tokens, otp_codes,
      users RESTART IDENTITY CASCADE`,
  );
  await prisma.governorate.upsert({
    where: { code: GOVERNORATE_CODE },
    update: {},
    create: {
      code: GOVERNORATE_CODE,
      slug: 'tunis',
      nameFr: 'Tunis',
      nameAr: 'تونس',
      nameEn: 'Tunis',
    },
  });
}

export async function createOwner(
  prisma: PrismaClient,
  tag: string,
  phone: string,
): Promise<string> {
  const owner = await prisma.user.create({
    data: {
      id: `${tag}_owner`,
      role: 'AGENCY_OWNER',
      status: 'ACTIVE',
      firstName: 'Gérant',
      lastName: tag.toUpperCase(),
      phone: toE164(phone),
      phoneVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return owner.id;
}

export interface SeedAgencyOptions {
  /** Préfixe des identifiants, références et e-mails : rend chaque agence reconnaissable. */
  tag: string;
  /** Premier chiffre des téléphones de l'agence (gérant et clients), pour l'unicité globale. */
  phoneDigit: string;
  now: Date;
  dataset?: AgencyDataset;
  /** Clients du jeu de données à rattacher à un compte existant (client commun à deux agences). */
  sharedCustomers?: ReadonlyMap<string, string>;
}

export interface SeededAgency {
  ownerId: string;
  agencyId: string;
  dataset: AgencyDataset;
  vehicleIds: string[];
  bookingIds: string[];
  customerIds: string[];
  paymentIds: string[];
  reviewIds: string[];
  hiddenReviewId: string | null;
}

/**
 * Insère le jeu de démo `createAgencyDataset` pour un nouveau gérant : identifiants explicites
 * préfixés par `tag`, triés comme les identifiants d'origine, et un avis masqué par la
 * modération.
 */
export async function seedAgency(
  prisma: PrismaClient,
  options: SeedAgencyOptions,
): Promise<SeededAgency> {
  const { tag, phoneDigit, now } = options;
  const dataset = options.dataset ?? createAgencyDataset(now);
  const id = (original: string) => `${tag}_${original}`;
  const ownerId = await createOwner(prisma, tag, `${phoneDigit}0000000`);
  const { profile, conditions } = dataset.settings;
  const agency = await prisma.agency.create({
    data: {
      id: id('agency'),
      ownerId,
      status: 'ACTIVE',
      ...profile,
      name: `${profile.name} ${tag.toUpperCase()}`,
      email: profile.email ?? null,
      governorateCode: GOVERNORATE_CODE,
      ...conditions,
    },
    select: { id: true },
  });

  const customerIds = new Map<string, string>();
  const newCustomers: Prisma.UserCreateManyInput[] = [];
  const emails = new Set<string>();
  for (const customer of dataset.customers) {
    const shared = options.sharedCustomers?.get(customer.id);
    if (shared !== undefined) {
      customerIds.set(customer.id, shared);
      continue;
    }
    const email = customer.email === null ? null : `${tag}.${customer.email}`;
    const uniqueEmail = email === null || emails.has(email) ? null : email;
    if (uniqueEmail !== null) {
      emails.add(uniqueEmail);
    }
    customerIds.set(customer.id, id(customer.id));
    newCustomers.push({
      id: id(customer.id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: toE164(`${phoneDigit}${customer.phone.slice(1)}`),
      phoneVerifiedAt: new Date(customer.createdAt),
      email: uniqueEmail,
      city: customer.city,
      createdAt: new Date(customer.createdAt),
    });
  }
  await prisma.user.createMany({ data: newCustomers });

  await prisma.vehicle.createMany({
    data: dataset.vehicles.map(
      ({ id: vehicleId, createdAt, photos: _photos, category, ...vehicle }) => ({
        ...vehicle,
        categoryId: categoryId(category),
        id: id(vehicleId),
        agencyId: agency.id,
        createdAt: new Date(createdAt),
      }),
    ),
  });

  const bookingCustomer = new Map<string, string>();
  await prisma.booking.createMany({
    data: dataset.bookings.map((booking) => {
      const customerId = customerIds.get(booking.customerId) ?? '';
      bookingCustomer.set(booking.id, customerId);
      return {
        id: id(booking.id),
        reference: `${tag.toUpperCase()}-${booking.reference}`,
        agencyId: agency.id,
        vehicleId: id(booking.vehicleId),
        customerId,
        pickupAt: new Date(booking.pickupAt),
        returnAt: new Date(booking.returnAt),
        pickupPlace: booking.pickupLocation,
        returnPlace: booking.returnLocation,
        status: booking.status,
        dailyRateMillimes: booking.dailyRateMillimes,
        totalMillimes: booking.totalMillimes,
        depositMillimes: booking.depositMillimes,
        customerNote: booking.customerNote,
        createdAt: new Date(booking.createdAt),
      };
    }),
  });
  await prisma.bookingEvent.createMany({
    data: dataset.bookings.flatMap((booking) =>
      booking.history.map((event, index) => ({
        id: `${id(booking.id)}_e${String(index).padStart(2, '0')}`,
        bookingId: id(booking.id),
        status: event.status,
        reason: event.reason,
        createdAt: new Date(event.at),
      })),
    ),
  });
  await prisma.payment.createMany({
    data: dataset.payments.map((payment) => ({
      id: id(payment.id),
      bookingId: id(payment.bookingId),
      kind: payment.kind,
      method: payment.method,
      amountMillimes: payment.amountMillimes,
      note: payment.note,
      recordedById: ownerId,
      recordedAt: new Date(payment.recordedAt),
    })),
  });
  const [firstReview] = dataset.reviews;
  await prisma.review.createMany({
    data: dataset.reviews.map((review) => ({
      id: id(review.id),
      bookingId: id(review.bookingId),
      agencyId: agency.id,
      customerId: bookingCustomer.get(review.bookingId) ?? '',
      rating: review.rating,
      comment: review.comment,
      reply: review.reply,
      repliedAt: review.repliedAt === null ? null : new Date(review.repliedAt),
      moderationStatus: review === firstReview ? 'HIDDEN' : 'PUBLISHED',
      createdAt: new Date(review.createdAt),
    })),
  });

  return {
    ownerId,
    agencyId: agency.id,
    dataset,
    vehicleIds: dataset.vehicles.map((vehicle) => id(vehicle.id)),
    bookingIds: dataset.bookings.map((booking) => id(booking.id)),
    customerIds: [...new Set(customerIds.values())],
    paymentIds: dataset.payments.map((payment) => id(payment.id)),
    reviewIds: dataset.reviews.map((review) => id(review.id)),
    hiddenReviewId: firstReview === undefined ? null : id(firstReview.id),
  };
}

export interface SmallAgencySeed {
  tag: string;
  ownerPhone: string;
  vehicles: { id: string; brand: string; model: string; plateNumber: string }[];
  customers: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    city: string;
  }[];
  bookings: {
    id: string;
    vehicleId: string;
    customerId: string;
    pickupAt?: Date;
    returnAt?: Date;
    status?: BookingStatus;
  }[];
}

const SMALL_PLACE = { fr: 'Tunis', ar: 'تونس', en: 'Tunis' };

/** Petite agence décrite ligne à ligne, pour les tests qui ciblent des cas précis. */
export async function seedSmallAgency(
  prisma: PrismaClient,
  seed: SmallAgencySeed,
): Promise<string> {
  const { tag } = seed;
  const ownerId = await createOwner(prisma, tag, seed.ownerPhone);
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
  });
  await prisma.vehicle.createMany({
    data: seed.vehicles.map((vehicle) => ({
      ...vehicle,
      agencyId: agency.id,
      year: 2024,
      categoryId: categoryId('compact'),
      transmission: 'MANUAL',
      fuel: 'PETROL',
      seats: 5,
      airConditioning: true,
      dailyRateMillimes: 100_000,
      depositMillimes: 500_000,
      color: '#2563EB',
    })),
  });
  await prisma.user.createMany({
    data: seed.customers.map((customer) => ({
      ...customer,
      phone: toE164(customer.phone),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    })),
  });
  await prisma.booking.createMany({
    data: seed.bookings.map((booking, index) => ({
      id: booking.id,
      vehicleId: booking.vehicleId,
      customerId: booking.customerId,
      reference: `${tag.toUpperCase()}-${String(index + 1).padStart(4, '0')}`,
      agencyId: agency.id,
      pickupAt: booking.pickupAt ?? new Date(Date.UTC(2026, 10, 1 + index * 5, 9)),
      returnAt: booking.returnAt ?? new Date(Date.UTC(2026, 10, 4 + index * 5, 9)),
      pickupPlace: SMALL_PLACE,
      returnPlace: SMALL_PLACE,
      status: booking.status ?? 'CONFIRMED',
      dailyRateMillimes: 100_000,
      totalMillimes: 300_000,
      depositMillimes: 500_000,
    })),
  });
  return ownerId;
}

/** Les taux calculés en SQL et en mémoire peuvent différer au-delà de la 12e décimale. */
export function roundFloats<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'number' && !Number.isInteger(item) ? Number(item.toFixed(9)) : item,
    ),
  ) as T;
}

// --- Moteur de référence (comportement d'avant la Phase 1) -------------------------------

/**
 * Chargement intégral de l'agence tel que le faisait l'ancien `load()` (sans le hash du mot de
 * passe), trié par identifiant pour rendre les ex aequo déterministes.
 */
export const LEGACY_AGENCY_INCLUDE = {
  vehicles: {
    include: { photos: VEHICLE_PHOTOS_INCLUDE, category: { select: { slug: true } } },
    orderBy: { id: 'asc' },
  },
  bookings: {
    orderBy: { id: 'asc' },
    include: {
      events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      payments: { orderBy: { id: 'asc' } },
      customer: { select: CUSTOMER_SELECT },
      review: true,
    },
  },
} satisfies Prisma.AgencyInclude;

type LegacyAgency = Prisma.AgencyGetPayload<{ include: typeof LEGACY_AGENCY_INCLUDE }>;

export function toLegacyDataset(agency: LegacyAgency): AgencyDataset {
  const vehicleNames = new Map(
    agency.vehicles.map((vehicle) => [vehicle.id, `${vehicle.brand} ${vehicle.model}`]),
  );
  const customers = new Map<string, Customer>();
  const reviews: Review[] = [];
  for (const booking of agency.bookings) {
    customers.set(booking.customerId, toCustomer(booking.customer));
    const { review, customer } = booking;
    if (review !== null && review.moderationStatus !== 'HIDDEN') {
      reviews.push({
        id: review.id,
        bookingId: booking.id,
        customerName: `${customer.firstName} ${customer.lastName.charAt(0)}.`,
        vehicleName: vehicleNames.get(booking.vehicleId) ?? '',
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        reply: review.reply,
        repliedAt: review.repliedAt?.toISOString() ?? null,
      });
    }
  }
  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    vehicles: agency.vehicles.map((vehicle) => toVehicle(vehicle, publicUrl)),
    customers: [...customers.values()].sort(byId),
    bookings: agency.bookings.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      vehicleId: booking.vehicleId,
      customerId: booking.customerId,
      pickupAt: booking.pickupAt.toISOString(),
      returnAt: booking.returnAt.toISOString(),
      pickupLocation: toPlace(booking.pickupPlace),
      returnLocation: toPlace(booking.returnPlace),
      status: booking.status,
      dailyRateMillimes: booking.dailyRateMillimes,
      totalMillimes: booking.totalMillimes,
      depositMillimes: booking.depositMillimes,
      customerNote: booking.customerNote,
      createdAt: booking.createdAt.toISOString(),
      history: booking.events.map((event) => ({
        status: event.status,
        at: event.createdAt.toISOString(),
        reason: event.reason,
      })),
    })),
    payments: agency.bookings.flatMap((booking) => booking.payments.map(toPayment)).sort(byId),
    reviews: reviews.sort(byId),
    settings: toSettings(agency, publicUrl),
  };
}

/** Ancien chemin de lecture : chargement complet de l'agence puis calcul en mémoire. */
export async function loadLegacyQueries(
  prisma: PrismaClient,
  agencyId: string,
  now: Date,
): Promise<AgencyQueries> {
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    include: LEGACY_AGENCY_INCLUDE,
  });
  return createAgencyQueries(toLegacyDataset(agency), now);
}

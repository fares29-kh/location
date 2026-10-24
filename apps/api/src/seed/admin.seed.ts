import {
  AGENCY_DOCUMENT_KINDS,
  type AgencyDocumentKind,
  addMonths,
  type AuditAction,
  billingPeriod,
  computeInvoiceAmounts,
  createRandom,
  DEFAULT_PLATFORM_SETTINGS,
  getDemoAccounts,
  type Random,
  toDayKey,
  toE164,
  toMonthKey,
  tunisDateTime,
} from '@drivetn/types';
import type {
  AgencyStatus,
  BookingStatus,
  FuelType,
  Governorate,
  PaymentMethod,
  Prisma,
  PrismaClient,
  ReviewReportReason,
  SubscriptionPlan,
  Transmission,
} from '@prisma/client';

import type { AuditEntityType } from '../audit/audit.service';
import { invoiceNumber } from '../platform/invoicing.service';
import { categoryIdsBySlug } from './categories';
import { linkVehicleGovernorate } from './locations.seed';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

interface PartnerSpec {
  name: string;
  slug: string;
  governorateCode: string;
  status: AgencyStatus;
  plan: SubscriptionPlan;
  ageDays: number;
  owner: readonly [firstName: string, lastName: string];
  commissionBps?: number;
  reason?: string;
  missingDocuments?: readonly AgencyDocumentKind[];
  /** Laisse une facture échue impayée (relancée). */
  latePayer?: boolean;
}

/** Agences partenaires de démonstration, dans chacun des statuts du cycle de validation. */
export const PARTNER_AGENCIES: readonly PartnerSpec[] = [
  {
    name: 'Carthage Rent',
    slug: 'carthage-rent',
    governorateCode: '11',
    status: 'ACTIVE',
    plan: 'PRO',
    ageDays: 320,
    owner: ['Walid', 'Hammami'],
  },
  {
    name: 'Sahel Auto Location',
    slug: 'sahel-auto',
    governorateCode: '51',
    status: 'ACTIVE',
    plan: 'BUSINESS',
    ageDays: 280,
    owner: ['Ines', 'Chaabane'],
    commissionBps: 300,
  },
  {
    name: 'Djerba Car',
    slug: 'djerba-car',
    governorateCode: '82',
    status: 'ACTIVE',
    plan: 'STARTER',
    ageDays: 210,
    owner: ['Nizar', 'Ayari'],
    latePayer: true,
  },
  {
    name: 'Sfax Location Pro',
    slug: 'sfax-location',
    governorateCode: '61',
    status: 'ACTIVE',
    plan: 'PRO',
    ageDays: 150,
    owner: ['Rim', 'Zouari'],
  },
  {
    name: 'Tabarka Auto',
    slug: 'tabarka-auto',
    governorateCode: '32',
    status: 'SUSPENDED',
    plan: 'STARTER',
    ageDays: 240,
    owner: ['Bilel', 'Dridi'],
    reason: 'Factures impayées et plusieurs réclamations clients non traitées.',
  },
  {
    name: 'Gafsa Auto Rent',
    slug: 'gafsa-auto',
    governorateCode: '71',
    status: 'REJECTED',
    plan: 'STARTER',
    ageDays: 45,
    owner: ['Hichem', 'Mejri'],
    reason: 'Registre de commerce illisible et matricule fiscal non concordant.',
  },
  {
    name: 'Kélibia Location',
    slug: 'kelibia-location',
    governorateCode: '21',
    status: 'PENDING_REVIEW',
    plan: 'STARTER',
    ageDays: 5,
    owner: ['Sarra', 'Ferchichi'],
  },
  {
    name: 'Ben Arous Rent',
    slug: 'ben-arous-rent',
    governorateCode: '13',
    status: 'PENDING_REVIEW',
    plan: 'PRO',
    ageDays: 3,
    owner: ['Youssef', 'Karray'],
  },
  {
    name: 'Médenine Cars',
    slug: 'medenine-cars',
    governorateCode: '82',
    status: 'PENDING_REVIEW',
    plan: 'STARTER',
    ageDays: 1,
    owner: ['Asma', 'Baccouche'],
    missingDocuments: ['INSURANCE', 'MANAGER_ID'],
  },
];

interface FleetModel {
  brand: string;
  model: string;
  /** Slug d'une catégorie créée par la migration du référentiel. */
  category: string;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  dailyRateMillimes: number;
  depositMillimes: number;
  color: string;
}

const FLEET: readonly FleetModel[] = [
  {
    brand: 'Kia',
    model: 'Picanto',
    category: 'city',
    transmission: 'MANUAL',
    fuel: 'PETROL',
    seats: 4,
    dailyRateMillimes: 75_000,
    depositMillimes: 500_000,
    color: '#2563EB',
  },
  {
    brand: 'Renault',
    model: 'Clio 5',
    category: 'compact',
    transmission: 'MANUAL',
    fuel: 'DIESEL',
    seats: 5,
    dailyRateMillimes: 95_000,
    depositMillimes: 700_000,
    color: '#059669',
  },
  {
    brand: 'Hyundai',
    model: 'Tucson',
    category: 'suv',
    transmission: 'AUTOMATIC',
    fuel: 'DIESEL',
    seats: 5,
    dailyRateMillimes: 210_000,
    depositMillimes: 1_500_000,
    color: '#334155',
  },
];

interface BookingPlan {
  /** Jours entre aujourd'hui et le départ (négatif : passé). */
  offset: number;
  days: number;
  status: BookingStatus;
  /** Index du véhicule dans `FLEET`. */
  vehicle: number;
}

/** Locations terminées, en jours avant aujourd'hui (seules celles postérieures à la validation). */
const COMPLETED_OFFSETS = [-140, -115, -90, -62, -40, -18] as const;

const REVIEW_COMMENTS: readonly (readonly [rating: number, comment: string])[] = [
  [5, 'Voiture impeccable et remise des clés très rapide. Je recommande.'],
  [4, 'Bon service, petite attente au retour mais personnel sympathique.'],
  [5, 'Accueil chaleureux, véhicule propre et conforme à la réservation.'],
  [3, 'Correct, mais le plein n’était pas complet au départ.'],
  [4, 'Agence réactive sur WhatsApp, je reviendrai.'],
];

const FLAGGED_REVIEWS: readonly (readonly [
  rating: number,
  comment: string,
  reasons: readonly ReviewReportReason[],
  hidden: boolean,
])[] = [
  [1, 'Arnaque totale, ces gens sont des voleurs, fuyez !!!', ['OFFENSIVE', 'OFFENSIVE'], false],
  [1, 'Appelez plutôt mon cousin au 22 345 678, il loue moins cher.', ['PERSONAL_DATA'], false],
  [5, 'Meilleurs prix sur www.location-pas-chere.example, cliquez ici.', ['SPAM', 'SPAM'], false],
  [3, 'Rien à voir avec la voiture mais le restaurant d’à côté est top.', ['OFF_TOPIC'], false],
  [2, 'Le gérant est incompétent et malpoli, honte à vous.', ['OFFENSIVE'], true],
];

const HIDDEN_REASON = 'Propos injurieux contraires à la charte de publication.';
const SUSPENDED_CUSTOMER_REASON = 'Usurpation d’identité signalée par une agence partenaire.';

export interface AdminDemoSeedResult {
  created: boolean;
  agencies: number;
  bookings: number;
  invoices: number;
}

type Tx = Prisma.TransactionClient;

interface OperatingAgency {
  id: string;
  name: string;
  plan: SubscriptionPlan;
  commissionBps: number | null;
  /** Début de la facturation (validation) et éventuelle suspension. */
  activeFrom: Date;
  suspendedAt: Date | null;
  latePayer: boolean;
}

function demoEmail(portal: 'agency' | 'client'): string {
  const [account] = getDemoAccounts(portal);
  if (account === undefined) {
    throw new Error(`Aucun compte de démo pour le portail ${portal}`);
  }
  return account.email;
}

function digits(random: Random, count: number): string {
  return Array.from({ length: count }, () => String(random.int(0, 9))).join('');
}

function taxId(random: Random): string {
  return `${String(random.int(1_000_000, 1_999_999))}/${random.pick(['A', 'B', 'M', 'N', 'P'])}/${random.pick(['A', 'M', 'P'])}/000`;
}

function at10(now: Date, offsetDays: number): Date {
  return tunisDateTime(toDayKey(new Date(now.getTime() + offsetDays * DAY_MS)), 10);
}

/**
 * Données de démonstration du portail d'administration : agences partenaires (en attente,
 * actives, suspendue, refusée), flottes, réservations, avis à modérer, factures et historique
 * du journal d'audit. Idempotent et atomique : ne fait rien si les agences existent déjà.
 */
export async function seedAdminDemo(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<AdminDemoSeedResult> {
  const skipped = { created: false, agencies: 0, bookings: 0, invoices: 0 };
  const [firstPartner] = PARTNER_AGENCIES;
  if (
    firstPartner === undefined ||
    (await prisma.user.findUnique({ where: { email: `gerant@${firstPartner.slug}.tn` } })) !== null
  ) {
    return skipped;
  }
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', email: { in: getDemoAccounts('admin').map((a) => a.email) } },
  });
  const reviewer = admins.find((admin) => admin.adminRole !== 'FINANCE');
  if (reviewer === undefined) {
    return skipped;
  }
  const finance = admins.find((admin) => admin.adminRole === 'FINANCE') ?? reviewer;

  return prisma.$transaction(
    (tx) => seed(tx, { now, reviewerId: reviewer.id, financeId: finance.id }),
    { timeout: 120_000 },
  );
}

async function seed(
  tx: Tx,
  { now, reviewerId, financeId }: { now: Date; reviewerId: string; financeId: string },
): Promise<AdminDemoSeedResult> {
  const random = createRandom(20_261_008);
  const audit: Prisma.AuditLogCreateManyInput[] = [];
  const log = (
    action: AuditAction,
    createdAt: Date,
    actorId: string | null,
    entityType: AuditEntityType,
    entityId: string,
    metadata: Prisma.InputJsonObject = {},
  ) => {
    audit.push({
      action,
      actorId,
      entityType,
      entityId,
      metadata,
      ip:
        actorId === null
          ? null
          : `197.${String(random.int(0, 30))}.${String(random.int(1, 254))}.${String(random.int(1, 254))}`,
      createdAt,
    });
  };
  const daysAgo = (days: number, hour = random.int(8, 19)) =>
    new Date(now.getTime() - days * DAY_MS - (now.getUTCHours() - hour) * HOUR_MS);

  const governorates = new Map(
    (await tx.governorate.findMany()).map((governorate) => [governorate.code, governorate]),
  );
  const customers = await tx.user.findMany({
    where: { role: 'CUSTOMER', status: 'ACTIVE', NOT: { email: demoEmail('client') } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });
  const operating: OperatingAgency[] = [];
  const reviewable: { bookingId: string; agencyId: string; customerId: string; returnAt: Date }[] =
    [];
  let bookingsCount = 0;

  // --- Agence de démo : fiche complétée et historique de validation -----------------
  const demoAgency = await tx.agency.findFirst({
    where: { owner: { email: demoEmail('agency') } },
  });
  if (demoAgency !== null) {
    const activeFrom = demoAgency.decidedAt ?? daysAgo(400);
    if (demoAgency.taxId === '') {
      const createdAt = new Date(activeFrom.getTime() - 2 * DAY_MS);
      await tx.agency.update({
        where: { id: demoAgency.id },
        data: {
          taxId: taxId(random),
          plan: 'PRO',
          createdAt,
          decidedAt: activeFrom,
          documents: {
            create: AGENCY_DOCUMENT_KINDS.map((kind) => ({
              kind,
              fileKey: `agencies/${demoAgency.id}/${kind.toLowerCase()}.pdf`,
              uploadedAt: createdAt,
            })),
          },
        },
      });
      log('agency.approved', activeFrom, reviewerId, 'agency', demoAgency.id);
    }
    operating.push({
      id: demoAgency.id,
      name: demoAgency.name,
      plan: demoAgency.taxId === '' ? 'PRO' : demoAgency.plan,
      commissionBps: demoAgency.commissionBps,
      activeFrom,
      suspendedAt: null,
      latePayer: false,
    });
  }

  // --- Agences partenaires ----------------------------------------------------------
  for (const [index, spec] of PARTNER_AGENCIES.entries()) {
    const governorate = governorates.get(spec.governorateCode);
    if (governorate === undefined) {
      continue;
    }
    const createdAt = daysAgo(spec.ageDays);
    const pending = spec.status === 'PENDING_REVIEW';
    const approvedAt = pending
      ? null
      : new Date(createdAt.getTime() + random.int(1, 3) * DAY_MS + 2 * HOUR_MS);
    const suspendedAt = spec.status === 'SUSPENDED' ? daysAgo(random.int(8, 20)) : null;

    const owner = await tx.user.create({
      data: {
        role: 'AGENCY_OWNER',
        status: 'ACTIVE',
        firstName: spec.owner[0],
        lastName: spec.owner[1],
        phone: toE164(`5090${String(index).padStart(4, '0')}`),
        phoneVerifiedAt: createdAt,
        email: `gerant@${spec.slug}.tn`,
        createdAt,
        lastLoginAt: pending ? null : daysAgo(random.int(0, 6)),
      },
    });
    const agency = await tx.agency.create({
      data: {
        ownerId: owner.id,
        status: spec.status,
        name: spec.name,
        phone: `7${digits(random, 7)}`,
        whatsappPhone: `9${digits(random, 7)}`,
        email: `contact@${spec.slug}.tn`,
        address: `${String(random.int(1, 180))}, avenue Habib Bourguiba, ${governorate.nameFr}`,
        governorateCode: governorate.code,
        description: `Location de voitures à ${governorate.nameFr} : citadines, compactes et SUV récents.`,
        taxId: taxId(random),
        plan: spec.plan,
        commissionBps: spec.commissionBps ?? null,
        decidedAt: suspendedAt ?? approvedAt ?? (spec.status === 'REJECTED' ? createdAt : null),
        statusReason: spec.reason ?? null,
        createdAt,
        documents: {
          create: AGENCY_DOCUMENT_KINDS.filter(
            (kind) => spec.missingDocuments?.includes(kind) !== true,
          ).map((kind) => ({
            kind,
            fileKey: `agencies/${spec.slug}/${kind.toLowerCase()}.pdf`,
            uploadedAt: new Date(createdAt.getTime() + random.int(5, 90) * 60_000),
          })),
        },
      },
    });
    log('agency.created', createdAt, owner.id, 'agency', agency.id);

    if (spec.status === 'REJECTED' && approvedAt !== null) {
      await tx.agency.update({ where: { id: agency.id }, data: { decidedAt: approvedAt } });
      log('agency.rejected', approvedAt, reviewerId, 'agency', agency.id, {
        previousStatus: 'PENDING_REVIEW',
        reason: spec.reason ?? '',
      });
      continue;
    }
    if (approvedAt === null) {
      continue;
    }
    log('agency.approved', approvedAt, reviewerId, 'agency', agency.id, {
      previousStatus: 'PENDING_REVIEW',
    });
    if (suspendedAt !== null) {
      log('agency.suspended', suspendedAt, reviewerId, 'agency', agency.id, {
        previousStatus: 'ACTIVE',
        reason: spec.reason ?? '',
      });
    }
    operating.push({
      id: agency.id,
      name: agency.name,
      plan: spec.plan,
      commissionBps: spec.commissionBps ?? null,
      activeFrom: approvedAt,
      suspendedAt,
      latePayer: spec.latePayer === true,
    });
    if (customers.length > 0) {
      bookingsCount += await seedActivity(tx, random, {
        agencyId: agency.id,
        agencyIndex: index,
        governorate,
        approvedAt,
        active: spec.status === 'ACTIVE',
        now,
        customerIds: customers.map((customer) => customer.id),
        log,
        reviewable,
      });
    }
  }

  // --- Avis signalés et masqués --------------------------------------------------------
  for (const [index, [rating, comment, reasons, hidden]] of FLAGGED_REVIEWS.entries()) {
    const target = reviewable[index * 2];
    if (target === undefined) {
      break;
    }
    const createdAt = new Date(target.returnAt.getTime() + random.int(3, 30) * HOUR_MS);
    const moderatedAt = hidden ? new Date(createdAt.getTime() + random.int(2, 20) * HOUR_MS) : null;
    const review = await tx.review.create({
      data: {
        bookingId: target.bookingId,
        agencyId: target.agencyId,
        customerId: target.customerId,
        rating,
        comment,
        createdAt,
        moderationStatus: hidden ? 'HIDDEN' : 'FLAGGED',
        moderatedAt,
        moderationReason: hidden ? HIDDEN_REASON : null,
        reports: {
          create: reasons.map((reason, position) => ({
            reason,
            createdAt: new Date(createdAt.getTime() + (position + 1) * HOUR_MS),
          })),
        },
      },
    });
    if (moderatedAt !== null) {
      log('review.hidden', moderatedAt, reviewerId, 'review', review.id, {
        agencyId: target.agencyId,
        reason: HIDDEN_REASON,
      });
    }
  }

  // --- Compte client suspendu -----------------------------------------------------------
  const suspended = customers[5];
  if (suspended !== undefined) {
    await tx.user.update({
      where: { id: suspended.id },
      data: { status: 'SUSPENDED', statusReason: SUSPENDED_CUSTOMER_REASON },
    });
    log('user.suspended', daysAgo(12), reviewerId, 'user', suspended.id, {
      reason: SUSPENDED_CUSTOMER_REASON,
    });
  }

  // --- Factures des trois derniers mois ---------------------------------------------------
  const invoices = await seedInvoices(tx, random, { now, operating, financeId, log });

  await tx.auditLog.createMany({ data: audit });
  return {
    created: true,
    agencies: PARTNER_AGENCIES.length,
    bookings: bookingsCount,
    invoices,
  };
}

async function seedActivity(
  tx: Tx,
  random: Random,
  context: {
    agencyId: string;
    agencyIndex: number;
    governorate: Governorate;
    approvedAt: Date;
    active: boolean;
    now: Date;
    customerIds: string[];
    log: (
      action: AuditAction,
      createdAt: Date,
      actorId: string | null,
      entityType: AuditEntityType,
      entityId: string,
    ) => void;
    reviewable: { bookingId: string; agencyId: string; customerId: string; returnAt: Date }[];
  },
): Promise<number> {
  const { agencyId, agencyIndex, governorate, approvedAt, active, now } = context;
  const categoryIds = await categoryIdsBySlug(tx);
  const vehicles = [];
  for (const { category, ...model } of FLEET) {
    const created = await tx.vehicle.create({
      data: {
        agencyId,
        ...model,
        categoryId: categoryIds(category),
        year: random.int(2021, 2025),
        plateNumber: `${String(random.int(180, 260))} TU ${String(random.int(1000, 9999))}`,
        airConditioning: true,
        mileageLimitKm: category === 'suv' ? null : 300,
        mileageKm: random.int(8_000, 90_000),
        createdAt: approvedAt,
      },
    });
    await linkVehicleGovernorate(tx, created.id, governorate.code);
    vehicles.push(created);
  }
  const place = {
    fr: `Agence · ${governorate.nameFr}`,
    ar: `الوكالة · ${governorate.nameAr}`,
    en: `Agency · ${governorate.nameEn}`,
  };

  const plans: BookingPlan[] = COMPLETED_OFFSETS.map((offset, index) => ({
    offset,
    days: random.int(3, 6),
    status: 'COMPLETED' as const,
    vehicle: index % FLEET.length,
  })).filter((plan) => at10(now, plan.offset).getTime() > approvedAt.getTime());
  if (active) {
    plans.push(
      { offset: -2, days: 5, status: 'PICKED_UP', vehicle: 2 },
      { offset: 12, days: 4, status: 'CONFIRMED', vehicle: 0 },
    );
  }

  for (const [position, plan] of plans.entries()) {
    const vehicle = vehicles[plan.vehicle];
    const customerId = random.pick(context.customerIds);
    if (vehicle === undefined) {
      continue;
    }
    const pickupAt = at10(now, plan.offset);
    const returnAt = new Date(pickupAt.getTime() + plan.days * DAY_MS);
    const createdAt = new Date(pickupAt.getTime() - random.int(3, 15) * DAY_MS);
    const totalMillimes = vehicle.dailyRateMillimes * plan.days;
    const path: [BookingStatus, Date][] = [
      ['PENDING', createdAt],
      ['CONFIRMED', new Date(createdAt.getTime() + random.int(1, 5) * HOUR_MS)],
    ];
    if (plan.status === 'PICKED_UP' || plan.status === 'COMPLETED') {
      path.push(['PICKED_UP', pickupAt]);
    }
    if (plan.status === 'COMPLETED') {
      path.push(['RETURNED', returnAt], ['COMPLETED', new Date(returnAt.getTime() + HOUR_MS)]);
    }
    const method: PaymentMethod = random.pick(['CASH', 'CARD_TPE', 'BANK_TRANSFER']);
    const booking = await tx.booking.create({
      data: {
        reference: `DTN-P${String(agencyIndex).padStart(2, '0')}${String(position).padStart(3, '0')}`,
        agencyId,
        vehicleId: vehicle.id,
        customerId,
        pickupAt,
        returnAt,
        pickupPlace: place,
        returnPlace: place,
        status: plan.status,
        dailyRateMillimes: vehicle.dailyRateMillimes,
        totalMillimes,
        depositMillimes: vehicle.depositMillimes,
        createdAt,
        events: {
          create: path.map(([status, at]) => ({ status, createdAt: at })),
        },
        payments:
          plan.status === 'CONFIRMED'
            ? undefined
            : {
                create: {
                  kind: 'RENTAL',
                  method,
                  amountMillimes: totalMillimes,
                  recordedAt: pickupAt,
                },
              },
      },
    });
    context.log('booking.created', createdAt, customerId, 'booking', booking.id);

    if (plan.status !== 'COMPLETED') {
      continue;
    }
    if (random.chance(0.5)) {
      const [rating, comment] = random.pick(REVIEW_COMMENTS);
      await tx.review.create({
        data: {
          bookingId: booking.id,
          agencyId,
          customerId,
          rating,
          comment,
          createdAt: new Date(returnAt.getTime() + random.int(3, 48) * HOUR_MS),
        },
      });
    } else {
      context.reviewable.push({ bookingId: booking.id, agencyId, customerId, returnAt });
    }
  }
  return plans.length;
}

async function seedInvoices(
  tx: Tx,
  random: Random,
  context: {
    now: Date;
    operating: OperatingAgency[];
    financeId: string;
    log: (
      action: AuditAction,
      createdAt: Date,
      actorId: string | null,
      entityType: AuditEntityType,
      entityId: string,
      metadata?: Prisma.InputJsonObject,
    ) => void;
  },
): Promise<number> {
  const { now, operating, financeId, log } = context;
  const settings = DEFAULT_PLATFORM_SETTINGS;
  const currentMonth = toMonthKey(now);
  const sequences = new Map<string, number>();
  let issued = 0;

  for (const offset of [-3, -2, -1]) {
    const period = billingPeriod(addMonths(currentMonth, offset));
    const eligible = operating.filter(
      (agency) =>
        agency.activeFrom.getTime() <= period.start.getTime() &&
        (agency.suspendedAt === null || agency.suspendedAt.getTime() >= period.end.getTime()),
    );
    if (eligible.length === 0 || period.issuedAt.getTime() > now.getTime()) {
      continue;
    }
    const revenues = await tx.booking.groupBy({
      by: ['agencyId'],
      where: {
        agencyId: { in: eligible.map((agency) => agency.id) },
        status: 'COMPLETED',
        pickupAt: { gte: period.start, lt: period.end },
      },
      _sum: { totalMillimes: true },
    });
    const year = toMonthKey(period.issuedAt).slice(0, 4);

    if (!sequences.has(year)) {
      const last = await tx.invoice.findFirst({
        where: { number: { startsWith: `FAC-${year}-` } },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      sequences.set(year, last === null ? 0 : Number.parseInt(last.number.slice(9), 10) || 0);
    }

    for (const agency of eligible) {
      const sequence = (sequences.get(year) ?? 0) + 1;
      sequences.set(year, sequence);
      const latest = offset === -1;
      const overdue = period.dueAt.getTime() < now.getTime();
      const unpaid =
        (agency.suspendedAt !== null && offset >= -2) ||
        (agency.latePayer && offset === -2) ||
        (latest && random.chance(0.5));
      const plannedPayment = new Date(
        period.issuedAt.getTime() + random.int(1, 12) * DAY_MS + random.int(1, 8) * HOUR_MS,
      );
      const paidAt =
        unpaid || plannedPayment.getTime() > now.getTime() - HOUR_MS ? null : plannedPayment;
      const remindedAt =
        paidAt === null && overdue
          ? new Date(Math.min(period.dueAt.getTime() + 3 * DAY_MS, now.getTime() - HOUR_MS))
          : null;
      const method: PaymentMethod = random.pick(['BANK_TRANSFER', 'BANK_TRANSFER', 'CHECK']);

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber(year, sequence),
          agencyId: agency.id,
          period: period.period,
          plan: agency.plan,
          ...computeInvoiceAmounts({
            plan: agency.plan,
            commissionBps: agency.commissionBps ?? settings.defaultCommissionBps,
            revenueMillimes:
              revenues.find((row) => row.agencyId === agency.id)?._sum.totalMillimes ?? 0,
            vatRateBps: settings.vatRateBps,
            fiscalStampMillimes: settings.fiscalStampMillimes,
          }),
          issuedAt: period.issuedAt,
          dueAt: period.dueAt,
          paidAt,
          paymentMethod: paidAt === null ? null : method,
          remindedAt,
        },
      });
      issued += 1;
      const metadata = { agencyId: agency.id };
      log('invoice.issued', period.issuedAt, null, 'invoice', invoice.id, {
        ...metadata,
        period: period.period,
      });
      if (paidAt !== null) {
        log('invoice.paid', paidAt, financeId, 'invoice', invoice.id, { ...metadata, method });
      }
      if (remindedAt !== null) {
        log('invoice.reminder_sent', remindedAt, financeId, 'invoice', invoice.id, metadata);
      }
    }
  }
  return issued;
}

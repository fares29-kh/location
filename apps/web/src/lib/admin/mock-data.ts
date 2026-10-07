import {
  type AdminRole,
  AGENCY_DOCUMENT_KINDS,
  type AgencyStatus,
  type BookingStatus,
  computeInvoiceTotals,
  type PaymentMethod,
  type PaymentStatus,
  type PlatformSettings,
  type ReviewReportReason,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  type SubscriptionPlan,
} from '@drivetn/types';

import { addMonths, toMonthKey } from '@/lib/agency/dates';
import { createRandom, type Random } from '@/lib/demo-random';

import type {
  Agency,
  AuditAction,
  AuditActor,
  AuditEntry,
  Invoice,
  ModeratedReview,
  PersonRef,
  PlatformBooking,
  PlatformUser,
} from './types';

/** Jeu de données de démonstration de la plateforme, déterministe et relatif à la date du jour. */
export interface AdminDataset {
  agencies: Agency[];
  users: PlatformUser[];
  bookings: PlatformBooking[];
  invoices: Invoice[];
  reviews: ModeratedReview[];
  audit: AuditEntry[];
  settings: PlatformSettings;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  vatRateBps: 1900,
  fiscalStampMillimes: 1000,
  defaultCommissionBps: 0,
  bookingExpiryHours: 24,
  supportPhone: '71000000',
  supportEmail: 'support@drivetn.tn',
};

const FIRST_NAMES = [
  'Mohamed',
  'Ahmed',
  'Youssef',
  'Amine',
  'Skander',
  'Walid',
  'Hichem',
  'Nizar',
  'Bilel',
  'Oussema',
  'Fatma',
  'Mariem',
  'Ines',
  'Sarra',
  'Rim',
  'Nour',
  'Yasmine',
  'Asma',
  'Emna',
  'Olfa',
] as const;

const LAST_NAMES = [
  'Ben Ali',
  'Trabelsi',
  'Gharbi',
  'Jaziri',
  'Hammami',
  'Bouazizi',
  'Mejri',
  'Ayari',
  'Chaabane',
  'Sassi',
  'Khelifi',
  'Dridi',
  'Ferchichi',
  'Ben Salah',
  'Zouari',
  'Mabrouk',
  'Baccouche',
  'Karray',
] as const;

const AGENCY_SPECS: readonly (readonly [name: string, city: string, status: AgencyStatus])[] = [
  ['Carthage Rent', 'Tunis', 'ACTIVE'],
  ['Sahel Auto Location', 'Sousse', 'ACTIVE'],
  ['Djerba Car', 'Djerba', 'ACTIVE'],
  ['Enfidha Airport Rent', 'Enfidha', 'ACTIVE'],
  ['Hammamet Wheels', 'Hammamet', 'ACTIVE'],
  ['Sfax Location Pro', 'Sfax', 'ACTIVE'],
  ['Monastir Rent a Car', 'Monastir', 'ACTIVE'],
  ['La Marsa Premium Cars', 'La Marsa', 'ACTIVE'],
  ['Nabeul Auto', 'Nabeul', 'ACTIVE'],
  ['Bizerte Cars', 'Bizerte', 'ACTIVE'],
  ['Tozeur Desert Cars', 'Tozeur', 'ACTIVE'],
  ['Mahdia Rent', 'Mahdia', 'ACTIVE'],
  ['Ariana Car Services', 'Ariana', 'ACTIVE'],
  ['Kairouan Mobility', 'Kairouan', 'ACTIVE'],
  ['Gabès Location', 'Gabès', 'ACTIVE'],
  ['Tabarka Auto', 'Tabarka', 'SUSPENDED'],
  ['Zarzis Location', 'Zarzis', 'SUSPENDED'],
  ['Gafsa Auto Rent', 'Gafsa', 'REJECTED'],
  ['Kélibia Location', 'Kélibia', 'PENDING_REVIEW'],
  ['Ben Arous Rent', 'Ben Arous', 'PENDING_REVIEW'],
  ['Sousse Express Location', 'Sousse', 'PENDING_REVIEW'],
  ['Médenine Cars', 'Médenine', 'PENDING_REVIEW'],
  ['Jendouba Drive', 'Jendouba', 'PENDING_REVIEW'],
];

const VEHICLES = [
  ['Kia', 'Picanto', 75],
  ['Hyundai', 'Grand i10', 80],
  ['Renault', 'Clio 5', 95],
  ['Peugeot', '208', 110],
  ['Volkswagen', 'Polo', 100],
  ['Dacia', 'Logan', 85],
  ['Hyundai', 'Accent', 120],
  ['Dacia', 'Duster', 150],
  ['Peugeot', '3008', 230],
  ['Hyundai', 'Tucson', 210],
] as const;

const SUSPENSION_REASONS = [
  'Plusieurs réclamations clients non traitées (véhicules non conformes).',
  'Attestation d’assurance flotte expirée, en attente de renouvellement.',
];
const REJECTION_REASON = 'Registre de commerce illisible et matricule fiscal non concordant.';

const REVIEW_COMMENTS: readonly (readonly [rating: number, comment: string])[] = [
  [5, 'Voiture impeccable et remise des clés très rapide à l’aéroport. Je recommande.'],
  [5, 'Accueil chaleureux, véhicule propre et conforme à la réservation.'],
  [4, 'Bon service, petite attente au retour mais personnel sympathique.'],
  [4, 'Rapport qualité-prix correct, voiture récente.'],
  [3, 'Correct, mais le plein n’était pas complet au départ.'],
  [2, 'Retard de 45 minutes à la livraison, aucune excuse.'],
  [5, 'Parfait pour notre séjour dans le Sud, voiture fiable.'],
  [4, 'Agence réactive sur WhatsApp, je reviendrai.'],
  [1, 'Caution encaissée deux fois, j’attends toujours le remboursement.'],
  [3, 'Véhicule un peu fatigué mais prix intéressant.'],
];

const FLAGGED_COMMENTS: readonly (readonly [number, string, ReviewReportReason])[] = [
  [1, 'Arnaque totale, ces gens sont des voleurs, fuyez !!!', 'OFFENSIVE'],
  [1, 'Appelez plutôt mon cousin au 22 345 678, il loue moins cher.', 'PERSONAL_DATA'],
  [5, 'Meilleurs prix sur www.location-pas-chere.example, cliquez ici.', 'SPAM'],
  [2, 'Le gérant est incompétent et malpoli, honte à vous.', 'OFFENSIVE'],
  [3, 'Rien à voir avec la voiture mais le restaurant d’à côté est top.', 'OFF_TOPIC'],
  [1, 'Je déconseille, la voiture sentait la cigarette.', 'OFFENSIVE'],
  [4, 'Contactez-moi sur mon numéro perso 98 765 432 pour un covoiturage.', 'PERSONAL_DATA'],
];

const HIDDEN_REASON = 'Propos injurieux contraires à la charte de publication.';

function iso(time: number): string {
  return new Date(time).toISOString();
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

function slugEmail(name: string, domain: string): string {
  return `${slug(name)}@${domain}`;
}

function mobile(random: Random): string {
  return `${String(random.pick([2, 5, 9]))}${String(random.int(1_000_000, 9_999_999))}`;
}

function ipAddress(random: Random): string {
  const prefix = random.pick(['197.2', '197.14', '41.226', '41.229', '102.158', '196.203']);
  return `${prefix}.${String(random.int(1, 254))}.${String(random.int(1, 254))}`;
}

function person(random: Random, id: string, domain = 'gmail.com'): PersonRef {
  const firstName = random.pick(FIRST_NAMES);
  const lastName = random.pick(LAST_NAMES);
  return {
    id,
    firstName,
    lastName,
    phone: mobile(random),
    email: random.chance(0.8)
      ? slugEmail(`${firstName} ${lastName} ${String(random.int(1, 99))}`, domain)
      : null,
  };
}

function taxId(random: Random): string {
  const letter = random.pick(['A', 'B', 'K', 'M', 'N', 'P']);
  return `${String(random.int(1_000_000, 1_999_999))}/${letter}/${random.pick(['A', 'M', 'P'])}/000`;
}

export function createAdminDataset(now: Date = new Date()): AdminDataset {
  const random = createRandom(20_261_007);
  const nowMs = now.getTime();
  const at = (daysAgo: number, hour = random.int(8, 20)) =>
    nowMs - daysAgo * DAY_MS - (now.getUTCHours() - hour) * HOUR_MS - random.int(0, 59) * 60_000;
  const settings = { ...DEFAULT_PLATFORM_SETTINGS };

  // --- Équipe d'administration -----------------------------------------------------
  const makeAdmin = (
    id: string,
    firstName: string,
    lastName: string,
    adminRole: AdminRole,
  ): PlatformUser => ({
    id,
    firstName,
    lastName,
    phone: mobile(random),
    email: slugEmail(`${firstName} ${lastName}`, 'drivetn.tn'),
    role: 'ADMIN',
    adminRole,
    status: 'ACTIVE',
    agency: null,
    bookingsCount: 0,
    createdAt: iso(at(random.int(300, 420))),
    lastLoginAt: iso(at(random.int(0, 2))),
    statusReason: null,
  });
  const superAdmin = makeAdmin('adm_1', 'Amira', 'Ben Salah', 'SUPER_ADMIN');
  const support = makeAdmin('adm_2', 'Karim', 'Trabelsi', 'SUPPORT');
  const finance = makeAdmin('adm_3', 'Mehdi', 'Gharbi', 'FINANCE');
  const admins = [superAdmin, support, makeAdmin('adm_4', 'Ines', 'Jaziri', 'SUPPORT'), finance];
  const reviewers = admins.filter((admin) => admin.adminRole !== 'FINANCE');
  const actorOf = (user: PlatformUser): AuditActor => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  });

  const audit: AuditEntry[] = [];
  const log = (
    action: AuditAction,
    time: number,
    actor: AuditActor | null,
    target: string | null,
    detail: string | null = null,
  ) => {
    audit.push({
      id: `aud_${String(audit.length + 1).padStart(4, '0')}`,
      action,
      actor,
      target,
      detail,
      ip: actor === null ? null : ipAddress(random),
      createdAt: iso(time),
    });
  };

  // --- Agences et leurs gérants ---------------------------------------------------
  const owners: PlatformUser[] = [];
  const agencies: Agency[] = AGENCY_SPECS.map(([name, city, status], index) => {
    const id = `agc_${String(index + 1).padStart(2, '0')}`;
    const pending = status === 'PENDING_REVIEW';
    const createdDaysAgo = pending ? random.int(0, 6) : random.int(90, 400);
    const createdAt = at(createdDaysAgo);
    const owner = person(random, `usr_own_${String(index + 1)}`);
    const domain = `${slug(name).replace(/\./g, '')}.tn`;
    const plan: SubscriptionPlan = pending
      ? 'STARTER'
      : random.weighted([
          ['STARTER', 4],
          ['PRO', 5],
          ['BUSINESS', 2],
        ]);
    const limit = SUBSCRIPTION_PLAN_DEFINITIONS[plan].vehicleLimit ?? 45;
    const decidedAt =
      status === 'PENDING_REVIEW' ? null : createdAt + random.int(1, 3) * DAY_MS + 2 * HOUR_MS;

    const ownerUser: PlatformUser = {
      ...owner,
      email: owner.email ?? slugEmail(`${owner.firstName} ${owner.lastName}`, domain),
      role: 'AGENCY_OWNER',
      adminRole: null,
      status: 'ACTIVE',
      agency: { id, name, city },
      bookingsCount: 0,
      createdAt: iso(createdAt),
      lastLoginAt: pending && random.chance(0.4) ? null : iso(at(random.int(0, 12))),
      statusReason: null,
    };
    owners.push(ownerUser);
    log('auth.signup', createdAt, actorOf(ownerUser), name);

    const reviewer = actorOf(random.pick(reviewers));
    let statusReason: string | null = null;
    if (decidedAt !== null && status === 'REJECTED') {
      statusReason = REJECTION_REASON;
      log('agency.rejected', decidedAt, reviewer, name, statusReason);
    } else if (decidedAt !== null) {
      log('agency.approved', decidedAt, reviewer, name);
      if (status === 'SUSPENDED') {
        statusReason = SUSPENSION_REASONS[index % SUSPENSION_REASONS.length] ?? null;
        log('agency.suspended', at(random.int(4, 20)), reviewer, name, statusReason);
      }
    }

    return {
      id,
      name,
      city,
      status,
      owner,
      phone: `7${String(random.int(1_000_000, 9_999_999))}`,
      email: random.chance(0.85) ? `contact@${domain}` : null,
      address: `${String(random.int(1, 180))}, avenue ${random.pick(['Habib Bourguiba', 'de la République', 'Farhat Hached', 'Hédi Chaker', 'de l’Environnement'])}, ${city}`,
      taxId: taxId(random),
      plan,
      commissionBps: !pending && random.chance(0.2) ? random.pick([300, 500]) : null,
      vehiclesCount: random.int(3, limit),
      bookingsCount: 0,
      gmvMonthMillimes: 0,
      rating: { average: 0, count: 0 },
      documents: AGENCY_DOCUMENT_KINDS.map((kind) => ({
        kind,
        uploadedAt:
          pending && kind !== 'TRADE_REGISTER' && random.chance(0.3)
            ? null
            : iso(createdAt + random.int(0, 20) * 60_000),
      })),
      createdAt: iso(createdAt),
      decidedAt: decidedAt === null ? null : iso(decidedAt),
      statusReason,
    };
  });

  const staff: PlatformUser[] = agencies
    .filter((agency) => agency.status === 'ACTIVE' && random.chance(0.45))
    .map((agency, index) => {
      const member = person(random, `usr_stf_${String(index + 1)}`);
      return {
        ...member,
        role: 'AGENCY_STAFF',
        adminRole: null,
        status: 'ACTIVE',
        agency: { id: agency.id, name: agency.name, city: agency.city },
        bookingsCount: 0,
        createdAt: iso(at(random.int(20, 200))),
        lastLoginAt: iso(at(random.int(0, 9))),
        statusReason: null,
      };
    });

  // --- Clients ---------------------------------------------------------------------
  const customers: PlatformUser[] = Array.from({ length: 140 }, (_, index) => {
    const base = person(random, `usr_cus_${String(index + 1).padStart(3, '0')}`);
    const createdDaysAgo = random.weighted([
      [random.int(0, 30), 3],
      [random.int(31, 180), 5],
      [random.int(181, 500), 4],
    ]);
    const verified = createdDaysAgo > 1 || random.chance(0.6);
    return {
      ...base,
      role: 'CUSTOMER',
      adminRole: null,
      status: verified ? 'ACTIVE' : 'PENDING_VERIFICATION',
      agency: null,
      bookingsCount: 0,
      createdAt: iso(at(createdDaysAgo)),
      lastLoginAt: verified ? iso(at(random.int(0, Math.min(createdDaysAgo, 60)))) : null,
      statusReason: null,
    };
  });
  for (const index of [7, 42, 93]) {
    const customer = customers[index];
    if (customer !== undefined) {
      customer.status = 'SUSPENDED';
      customer.statusReason = 'Usurpation d’identité signalée par une agence partenaire.';
      log(
        'user.suspended',
        at(random.int(2, 40)),
        actorOf(random.pick(reviewers)),
        `${customer.firstName} ${customer.lastName}`,
        customer.statusReason,
      );
    }
  }

  // --- Réservations ------------------------------------------------------------------
  const operating = agencies.filter(
    (agency) => agency.status === 'ACTIVE' || agency.status === 'SUSPENDED',
  );
  const activeCustomers = customers.filter(
    (customer) => customer.status !== 'PENDING_VERIFICATION',
  );
  const bookings: PlatformBooking[] = [];
  for (let index = 0; index < 340; index += 1) {
    const agency = random.pick(operating);
    const weight = agency.plan === 'BUSINESS' ? 3 : agency.plan === 'PRO' ? 2 : 1;
    if (random.next() > weight / 3) {
      continue;
    }
    const customer = random.pick(activeCustomers);
    const [brand, model, rate] = random.pick(VEHICLES);
    const startOffset = random.int(-175, 30);
    const days = random.int(2, 9);
    const pickupAt =
      nowMs + startOffset * DAY_MS + (random.int(8, 18) - now.getUTCHours()) * HOUR_MS;
    const returnAt = pickupAt + days * DAY_MS;
    const createdAt = pickupAt - random.int(1, 21) * DAY_MS - random.int(0, 20) * HOUR_MS;
    let status: BookingStatus;
    if (agency.status === 'SUSPENDED' && pickupAt > nowMs) {
      status = 'CANCELLED';
    } else if (pickupAt > nowMs) {
      status = random.weighted([
        ['PENDING', 2],
        ['CONFIRMED', 6],
        ['CANCELLED', 1],
      ]);
    } else if (returnAt > nowMs) {
      status = 'PICKED_UP';
    } else {
      status = random.weighted([
        ['COMPLETED', 20],
        ['CANCELLED', 2],
        ['REJECTED', 1],
        ['NO_SHOW', 1],
        ['EXPIRED', 1],
      ]);
    }
    const paymentStatus: PaymentStatus =
      status === 'COMPLETED'
        ? 'PAID'
        : status === 'PICKED_UP'
          ? random.pick(['DEPOSIT_PAID', 'PAID'] as const)
          : status === 'CONFIRMED'
            ? random.pick(['UNPAID', 'DEPOSIT_PAID'] as const)
            : 'UNPAID';
    customer.bookingsCount += 1;
    bookings.push({
      id: `bkg_${String(bookings.length + 1).padStart(4, '0')}`,
      reference: `DTN-${String(48_210 + bookings.length * 7)}`,
      status,
      paymentStatus,
      agency: { id: agency.id, name: agency.name, city: agency.city },
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
      },
      vehicle: {
        brand,
        model,
        plateNumber: `${String(random.int(180, 260))} TU ${String(random.int(1000, 9999))}`,
      },
      pickupAt: iso(pickupAt),
      returnAt: iso(returnAt),
      pickupLocation: random.chance(0.4) ? `Aéroport · ${agency.city}` : `Agence · ${agency.city}`,
      totalMillimes: rate * days * 1000,
      createdAt: iso(Math.min(createdAt, nowMs - HOUR_MS)),
    });
  }
  // Les demandes en attente sont récentes ; deux d'entre elles ont dépassé le délai d'expiration.
  bookings
    .filter((booking) => booking.status === 'PENDING')
    .forEach((booking, index) => {
      const hoursAgo = index < 2 ? settings.bookingExpiryHours + 6 + index * 9 : random.int(1, 20);
      booking.createdAt = iso(nowMs - hoursAgo * HOUR_MS - random.int(0, 59) * 60_000);
    });
  bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const currentMonth = toMonthKey(now);
  const rented: readonly BookingStatus[] = ['PICKED_UP', 'RETURNED', 'COMPLETED'];
  for (const agency of agencies) {
    const own = bookings.filter((booking) => booking.agency.id === agency.id);
    agency.bookingsCount = own.length;
    agency.gmvMonthMillimes = own
      .filter(
        (booking) =>
          rented.includes(booking.status) && toMonthKey(booking.pickupAt) === currentMonth,
      )
      .reduce((sum, booking) => sum + booking.totalMillimes, 0);
  }

  // --- Factures d'abonnement ----------------------------------------------------------
  const invoices: Invoice[] = [];
  let invoiceSequence = 1;
  for (let monthsAgo = 4; monthsAgo >= 0; monthsAgo -= 1) {
    const issueMonth = addMonths(currentMonth, -monthsAgo);
    const period = addMonths(issueMonth, -1);
    const issuedAt = Date.parse(`${issueMonth}-01T08:00:00Z`);
    const dueAt = Date.parse(`${issueMonth}-15T22:59:00Z`);
    for (const agency of operating) {
      if (Date.parse(agency.decidedAt ?? agency.createdAt) > Date.parse(`${period}-01T00:00:00Z`)) {
        continue;
      }
      const subscription = SUBSCRIPTION_PLAN_DEFINITIONS[agency.plan].monthlyPriceMillimes;
      const commissionBps = agency.commissionBps ?? settings.defaultCommissionBps;
      const periodGmv = bookings
        .filter(
          (booking) =>
            booking.agency.id === agency.id &&
            booking.status === 'COMPLETED' &&
            toMonthKey(booking.pickupAt) === period,
        )
        .reduce((sum, booking) => sum + booking.totalMillimes, 0);
      const commission = Math.round((periodGmv * commissionBps) / 10_000);
      const totals = computeInvoiceTotals({
        subtotalMillimes: subscription + commission,
        vatRateBps: settings.vatRateBps,
        fiscalStampMillimes: settings.fiscalStampMillimes,
      });
      const pastDue = dueAt < nowMs;
      const unpaid =
        agency.status === 'SUSPENDED'
          ? monthsAgo <= 1
          : pastDue
            ? random.chance(0.08)
            : random.chance(0.55);
      const plannedPayment = unpaid
        ? null
        : issuedAt + random.int(1, 13) * DAY_MS + random.int(0, 8) * HOUR_MS;
      const paidAt =
        plannedPayment !== null && plannedPayment < nowMs - HOUR_MS ? plannedPayment : null;
      const invoice: Invoice = {
        id: `inv_${String(invoiceSequence).padStart(4, '0')}`,
        number: `FAC-${issueMonth.slice(0, 4)}-${String(invoiceSequence).padStart(4, '0')}`,
        agency: { id: agency.id, name: agency.name, city: agency.city },
        period,
        plan: agency.plan,
        subscriptionMillimes: subscription,
        commissionMillimes: commission,
        vatRateBps: settings.vatRateBps,
        ...totals,
        status: paidAt !== null ? 'PAID' : pastDue ? 'OVERDUE' : 'ISSUED',
        issuedAt: iso(issuedAt),
        dueAt: iso(dueAt),
        paidAt: paidAt === null ? null : iso(paidAt),
        paymentMethod:
          paidAt === null
            ? null
            : random.weighted<PaymentMethod>([
                ['BANK_TRANSFER', 6],
                ['CHECK', 2],
                ['CASH', 1],
              ]),
        remindedAt: null,
      };
      invoiceSequence += 1;
      invoices.push(invoice);
      if (issuedAt <= nowMs) {
        log('invoice.issued', issuedAt, null, invoice.number);
      }
      if (paidAt !== null) {
        log('invoice.paid', paidAt, actorOf(finance), invoice.number);
      }
      if (invoice.status === 'OVERDUE' && random.chance(0.5)) {
        invoice.remindedAt = iso(Math.min(dueAt + random.int(1, 6) * DAY_MS, nowMs - HOUR_MS));
        log(
          'invoice.reminder_sent',
          Date.parse(invoice.remindedAt),
          actorOf(finance),
          invoice.number,
        );
      }
    }
  }
  const issuedInvoices = invoices.filter((invoice) => Date.parse(invoice.issuedAt) <= nowMs);
  issuedInvoices.sort(
    (a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number),
  );

  // --- Avis clients --------------------------------------------------------------------
  const reviews: ModeratedReview[] = [];
  const completed = bookings.filter((booking) => booking.status === 'COMPLETED');
  for (const booking of completed) {
    if (!random.chance(0.35)) {
      continue;
    }
    const [rating, comment] = random.pick(REVIEW_COMMENTS);
    const createdAt = Date.parse(booking.returnAt) + random.int(2, 72) * HOUR_MS;
    reviews.push({
      id: `rev_${String(reviews.length + 1).padStart(3, '0')}`,
      agency: booking.agency,
      author: { firstName: booking.customer.firstName, lastName: booking.customer.lastName },
      rating,
      comment,
      agencyReply:
        random.chance(0.4) && rating >= 3
          ? 'Merci pour votre confiance, au plaisir de vous revoir !'
          : null,
      status: 'PUBLISHED',
      reports: [],
      createdAt: iso(Math.min(createdAt, nowMs - HOUR_MS)),
      moderatedAt: null,
      moderationReason: null,
    });
  }
  FLAGGED_COMMENTS.forEach(([rating, comment, reason], index) => {
    const booking = completed[index * 5 + 3] ?? completed[0];
    if (booking === undefined) {
      return;
    }
    const hidden = index >= FLAGGED_COMMENTS.length - 2;
    const createdAt = nowMs - random.int(1, hidden ? 30 : 6) * DAY_MS;
    const moderatedAt = hidden ? createdAt + random.int(2, 20) * HOUR_MS : null;
    reviews.push({
      id: `rev_f${String(index + 1)}`,
      agency: booking.agency,
      author: { firstName: booking.customer.firstName, lastName: booking.customer.lastName },
      rating,
      comment,
      agencyReply: null,
      status: hidden ? 'HIDDEN' : 'FLAGGED',
      reports: [
        { reason, count: random.int(1, 4) },
        ...(reason !== 'SPAM' && random.chance(0.4) ? [{ reason: 'SPAM' as const, count: 1 }] : []),
      ],
      createdAt: iso(createdAt),
      moderatedAt: moderatedAt === null ? null : iso(moderatedAt),
      moderationReason: hidden ? HIDDEN_REASON : null,
    });
    if (moderatedAt !== null) {
      log(
        'review.hidden',
        moderatedAt,
        actorOf(random.pick(reviewers)),
        booking.agency.name,
        HIDDEN_REASON,
      );
    }
  });
  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const agency of agencies) {
    const visible = reviews.filter(
      (review) => review.agency.id === agency.id && review.status !== 'HIDDEN',
    );
    agency.rating = {
      average:
        visible.length === 0
          ? 0
          : visible.reduce((sum, review) => sum + review.rating, 0) / visible.length,
      count: visible.length,
    };
  }

  // --- Connexions et sécurité ---------------------------------------------------------
  const loginUsers = [...admins, ...owners.filter((owner) => owner.lastLoginAt !== null), ...staff];
  for (let index = 0; index < 90; index += 1) {
    const user = random.pick(loginUsers);
    log(
      random.chance(0.08) ? 'auth.login_failed' : 'auth.login',
      at(random.int(0, 20)),
      actorOf(user),
      null,
    );
  }
  for (const customer of customers.filter(
    (item) => Date.parse(item.createdAt) > nowMs - 30 * DAY_MS,
  )) {
    log('auth.signup', Date.parse(customer.createdAt), actorOf(customer), null);
  }
  log('auth.password_reset', at(3), actorOf(random.pick(owners)), null);
  log('auth.password_changed', at(9), actorOf(support), null);
  log(
    'settings.updated',
    at(45),
    actorOf(superAdmin),
    null,
    'Délai d’expiration des demandes : 48 h → 24 h',
  );

  const users = [...admins, ...owners, ...staff, ...customers];

  return {
    agencies,
    users,
    bookings,
    invoices: issuedInvoices,
    reviews,
    audit: audit
      .filter((entry) => Date.parse(entry.createdAt) <= nowMs)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    settings,
  };
}

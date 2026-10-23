import {
  BOOKING_FILTER_STATUSES,
  type BookingFilter,
  type BookingSort,
  type DayKey,
  PAYMENT_METHODS,
  type PaymentQuery,
  type ReviewFilter,
  tunisDateTime,
} from '@drivetn/types';
import { type BookingStatus, Prisma } from '@prisma/client';

import { VEHICLE_PHOTOS_INCLUDE } from '../storage/vehicle-photos';

/** Réservations ayant immobilisé le véhicule : occupation, chiffre d'affaires et solde dû. */
export const RENTED_STATUSES: BookingStatus[] = ['PICKED_UP', 'RETURNED', 'COMPLETED'];

export const PLANNING_STATUSES: BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
];

export const DAY_MS = 86_400_000;
export const OCCUPANCY_WINDOW_MS = 30 * DAY_MS;

/** Colonnes d'un client exposées à l'agence (jamais le hash du mot de passe). */
export const CUSTOMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  city: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Seul le slug de la catégorie est exposé ; les libellés viennent du référentiel public. */
export const VEHICLE_CATEGORY_INCLUDE = { select: { slug: true } } as const;

/** Les vues réservation n'affichent que la vignette du véhicule : seule la couverture est lue. */
export const BOOKING_VIEW_INCLUDE = {
  vehicle: {
    include: {
      photos: { ...VEHICLE_PHOTOS_INCLUDE, take: 1 },
      category: VEHICLE_CATEGORY_INCLUDE,
    },
  },
  customer: { select: CUSTOMER_SELECT },
  events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  payments: { orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.BookingInclude;

/** Le planning n'affiche que des barres : ni historique, ni encaissements, ni fiche véhicule. */
export const PLANNING_BOOKING_SELECT = {
  id: true,
  reference: true,
  vehicleId: true,
  status: true,
  pickupAt: true,
  returnAt: true,
  totalMillimes: true,
  customer: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BookingSelect;

export const BOOKING_REF_INCLUDE = {
  customer: { select: { firstName: true, lastName: true } },
} satisfies Prisma.BookingInclude;

export const REVIEW_INCLUDE = {
  booking: {
    select: {
      vehicle: { select: { brand: true, model: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ReviewInclude;

/** Les avis masqués par la modération ne sont ni listés ni comptés. */
export const VISIBLE_REVIEW = {
  moderationStatus: { not: 'HIDDEN' },
} satisfies Prisma.ReviewWhereInput;

// --- Recherche, filtres et tris ----------------------------------------------------

const MAX_SEARCH_TERMS = 5;
const MIN_PHONE_DIGITS = 3;

/** Chaque mot de la recherche doit figurer dans l'un des champs (« Amira Trabelsi », « Clio 123 »). */
export function searchTerms(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .slice(0, MAX_SEARCH_TERMS);
}

function phoneDigits(term: string): string | null {
  const digits = term.replace(/\D/g, '');
  return digits.length >= MIN_PHONE_DIGITS ? digits : null;
}

/** Ni Prisma ni PostgreSQL n'échappent les motifs LIKE : `%`, `_` et `\` sont rendus littéraux. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}

/** Les immatriculations se comparent sans espaces ni tirets (« 123TU4567 », « 123-TU-4567 »). */
function plateKey(term: string): string {
  return term.replace(/[\s-]/g, '');
}

// `search_fold` (migration 20261008050000) replie casse et accents. Ces expressions doivent
// rester identiques à celles des index trigrammes de la migration, sinon ils sont ignorés.
const CUSTOMER_NAME = Prisma.sql`search_fold(u.first_name || ' ' || u.last_name)`;
const CUSTOMER_CONTACT = Prisma.sql`search_fold(COALESCE(u.email, '') || ' ' || COALESCE(u.city, ''))`;

function folded(column: Prisma.Sql, value: string): Prisma.Sql {
  return Prisma.sql`${column} LIKE search_fold(${containsPattern(value)})`;
}

/**
 * Conditions de recherche sur `bookings b`, à ajouter après un `WHERE` : chaque mot doit
 * figurer dans la référence, le nom ou le téléphone du client, ou le véhicule de l'agence.
 * Les sous-requêtes (clients via les index trigrammes, véhicules de l'agence) sont évaluées
 * une seule fois, puis consultées par hachage pour chaque réservation.
 */
export function bookingSearchSql(agencyId: string, search: string): Prisma.Sql {
  const terms = searchTerms(search);
  if (terms.length === 0) {
    return Prisma.empty;
  }
  const conditions = terms.map((term) => {
    const digits = phoneDigits(term);
    const phone =
      digits === null ? Prisma.empty : Prisma.sql` OR u.phone LIKE ${containsPattern(digits)}`;
    const plate = plateKey(term);
    const plateMatch =
      plate.length === 0
        ? Prisma.empty
        : Prisma.sql` OR ${folded(Prisma.sql`search_fold(translate(v.plate_number, ' -', ''))`, plate)} OR ${folded(Prisma.sql`search_fold(translate(v.retired_plate_number, ' -', ''))`, plate)}`;
    return Prisma.sql`(
      b.reference ILIKE ${containsPattern(term)}
      OR b.customer_id IN (SELECT u.id FROM users u WHERE ${folded(CUSTOMER_NAME, term)}${phone})
      OR b.vehicle_id IN (
        SELECT v.id FROM vehicles v
        WHERE v.agency_id = ${agencyId}
          AND (${folded(Prisma.sql`search_fold(v.brand || ' ' || v.model)`, term)}${plateMatch})
      )
    )`;
  });
  return Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`;
}

function bookingFilterSql(filter: BookingFilter): Prisma.Sql {
  return filter === 'all'
    ? Prisma.empty
    : Prisma.sql`AND ${statusIn(Prisma.sql`b.status`, BOOKING_FILTER_STATUSES[filter])}`;
}

/** L'identifiant départage les ex aequo : la pagination ne saute ni ne répète aucune ligne. */
function bookingOrderSql(sort: BookingSort): Prisma.Sql {
  switch (sort) {
    case 'pickup_asc':
      return Prisma.sql`b.pickup_at ASC, b.id ASC`;
    case 'created_desc':
      return Prisma.sql`b.created_at DESC, b.id ASC`;
    case 'pickup_desc':
      return Prisma.sql`b.pickup_at DESC, b.id ASC`;
  }
}

export interface StatusCountRow {
  status: BookingStatus;
  count: number;
}

export function bookingStatusCountsQuery(agencyId: string, search: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT b.status, COUNT(*)::int AS count
    FROM bookings b
    WHERE b.agency_id = ${agencyId} ${search}
    GROUP BY b.status`;
}

export interface IdRow {
  id: string;
}

/** Identifiants d'une page de réservations, dans l'ordre d'affichage. */
export function bookingPageQuery(
  agencyId: string,
  search: Prisma.Sql,
  query: { filter: BookingFilter; sort: BookingSort },
  page: { skip: number; take: number },
): Prisma.Sql {
  return Prisma.sql`
    SELECT b.id
    FROM bookings b
    WHERE b.agency_id = ${agencyId} ${search} ${bookingFilterSql(query.filter)}
    ORDER BY ${bookingOrderSql(query.sort)}
    LIMIT ${page.take} OFFSET ${page.skip}`;
}

export function paymentWhere(
  agencyId: string,
  query: Pick<PaymentQuery, 'kind' | 'method'>,
): Prisma.PaymentWhereInput {
  return {
    booking: { agencyId },
    ...(query.kind === 'ALL' ? {} : { kind: query.kind }),
    ...(query.method === 'ALL' ? {} : { method: query.method }),
  };
}

export function reviewFilterWhere(filter: ReviewFilter): Prisma.ReviewWhereInput {
  switch (filter) {
    case 'unanswered':
      return { reply: null };
    case 'positive':
      return { rating: { gte: 4 } };
    case 'critical':
      return { rating: { lte: 3 } };
    case 'all':
      return {};
  }
}

// --- Jours et mois de l'agence (fuseau Africa/Tunis) -------------------------------

export function startOfDay(day: DayKey): Date {
  return tunisDateTime(day, 0);
}

/** `monthKey` au format « AAAA-MM ». */
export function startOfMonth(monthKey: string): Date {
  return tunisDateTime(`${monthKey}-01`, 0);
}

export interface Period {
  start: Date;
  end: Date;
}

// --- Agrégats SQL --------------------------------------------------------------------
// Les colonnes DateTime de Prisma sont des `timestamp` sans fuseau contenant de l'UTC : les
// bornes sont transmises en texte ISO et converties explicitement, quel que soit le fuseau
// de la session PostgreSQL.

function at(date: Date): Prisma.Sql {
  return Prisma.sql`${date.toISOString()}::timestamp`;
}

function within(column: Prisma.Sql, period: Period): Prisma.Sql {
  return Prisma.sql`${column} >= ${at(period.start)} AND ${column} < ${at(period.end)}`;
}

function statusIn(column: Prisma.Sql, statuses: readonly BookingStatus[]): Prisma.Sql {
  return Prisma.sql`${column} IN (${Prisma.join(
    statuses.map((status) => Prisma.sql`${status}::"BookingStatus"`),
  )})`;
}

/** Encaissement net d'un paiement `p` (location moins remboursement, cf. `summarizePayments`). */
const NET_RENTAL = Prisma.sql`CASE p.kind WHEN 'RENTAL' THEN p.amount_millimes WHEN 'REFUND' THEN -p.amount_millimes ELSE 0 END`;

const NET_DEPOSIT = Prisma.sql`CASE p.kind WHEN 'DEPOSIT_HELD' THEN p.amount_millimes WHEN 'DEPOSIT_RETURNED' THEN -p.amount_millimes ELSE 0 END`;

export interface BookingKpisRow {
  bookings_month: number;
  bookings_previous_month: number;
  pending_count: number;
}

export function bookingKpisQuery(agencyId: string, month: Period, previous: Period): Prisma.Sql {
  const countable = Prisma.sql`b.status NOT IN ('REJECTED', 'EXPIRED')`;
  const createdAt = Prisma.sql`b.created_at`;
  return Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE ${countable} AND ${within(createdAt, month)})::int AS bookings_month,
      COUNT(*) FILTER (WHERE ${countable} AND ${within(createdAt, previous)})::int AS bookings_previous_month,
      COUNT(*) FILTER (WHERE b.status = 'PENDING')::int AS pending_count
    FROM bookings b
    WHERE b.agency_id = ${agencyId}`;
}

export interface FleetRow {
  active: number;
  on_rent: number;
  maintenance: number;
  inactive: number;
}

export function fleetQuery(agencyId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE v.status = 'ACTIVE')::int AS active,
      COUNT(*) FILTER (WHERE v.status = 'ACTIVE' AND rented.vehicle_id IS NOT NULL)::int AS on_rent,
      COUNT(*) FILTER (WHERE v.status = 'MAINTENANCE')::int AS maintenance,
      COUNT(*) FILTER (WHERE v.status = 'INACTIVE')::int AS inactive
    FROM vehicles v
    LEFT JOIN (
      SELECT DISTINCT b.vehicle_id FROM bookings b
      WHERE b.agency_id = ${agencyId} AND b.status = 'PICKED_UP'
    ) rented ON rented.vehicle_id = v.id
    WHERE v.agency_id = ${agencyId}
      AND v.deleted_at IS NULL`;
}

/** Durée louée (secondes) entre `since` et `now` : jamais au-delà de maintenant. */
function rentedSeconds(now: Date, since: Date): Prisma.Sql {
  return Prisma.sql`EXTRACT(EPOCH FROM LEAST(b.return_at, ${at(now)}) - GREATEST(b.pickup_at, ${at(since)}))`;
}

export interface OccupancyRow {
  rented_seconds: number;
}

/** Occupation de la flotte active sur la fenêtre [since, now[. */
export function fleetOccupancyQuery(agencyId: string, now: Date, since: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT COALESCE(SUM(${rentedSeconds(now, since)}), 0)::float8 AS rented_seconds
    FROM bookings b
    JOIN vehicles v ON v.id = b.vehicle_id
    WHERE b.agency_id = ${agencyId}
      AND v.status = 'ACTIVE'
      AND ${statusIn(Prisma.sql`b.status`, RENTED_STATUSES)}
      AND b.pickup_at < ${at(now)}
      AND b.return_at > ${at(since)}`;
}

export interface VehicleStatsRow {
  vehicle_id: string;
  rented_seconds: number;
  revenue: bigint;
}

/** Occupation et chiffre d'affaires sur 30 jours, par véhicule. */
export function vehicleStatsQuery(
  agencyId: string,
  now: Date,
  since: Date,
  vehicleId?: string,
): Prisma.Sql {
  const scope =
    vehicleId === undefined ? Prisma.empty : Prisma.sql`AND b.vehicle_id = ${vehicleId}`;
  return Prisma.sql`
    SELECT
      b.vehicle_id,
      COALESCE(SUM(${rentedSeconds(now, since)}) FILTER (WHERE b.pickup_at < ${at(now)}), 0)::float8 AS rented_seconds,
      COALESCE(SUM(b.total_millimes) FILTER (WHERE b.pickup_at >= ${at(since)}), 0)::bigint AS revenue
    FROM bookings b
    WHERE b.agency_id = ${agencyId}
      AND ${statusIn(Prisma.sql`b.status`, RENTED_STATUSES)}
      AND b.return_at > ${at(since)}
      ${scope}
    GROUP BY b.vehicle_id`;
}

export interface NextBookingRow {
  id: string;
  vehicle_id: string;
  reference: string;
  pickup_at: Date;
  return_at: Date;
  status: BookingStatus;
  first_name: string;
  last_name: string;
}

/** Prochaine réservation à venir de chaque véhicule (une ligne par véhicule au plus). */
export function nextBookingsQuery(agencyId: string, now: Date, vehicleId?: string): Prisma.Sql {
  const scope =
    vehicleId === undefined ? Prisma.empty : Prisma.sql`AND b.vehicle_id = ${vehicleId}`;
  return Prisma.sql`
    SELECT DISTINCT ON (b.vehicle_id)
      b.id, b.vehicle_id, b.reference, b.pickup_at, b.return_at, b.status, u.first_name, u.last_name
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    WHERE b.agency_id = ${agencyId}
      AND b.status IN ('CONFIRMED', 'PENDING')
      AND b.pickup_at >= ${at(now)}
      ${scope}
    ORDER BY b.vehicle_id, b.pickup_at ASC, b.id ASC`;
}

/** Départs confirmés ou déjà effectués : base du rapport d'activité. */
export const ACTIVITY_STATUSES: BookingStatus[] = [
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
];

export interface ActivityAmountRow {
  amounts: bigint[];
  previous: bigint;
}

export interface ActivityCountRow {
  counts: number[];
  previous: number;
}

/** Encaissements nets par tranche, et total de la période précédente. */
export function activityRevenueQuery(
  agencyId: string,
  buckets: Period[],
  previous: Period,
): Prisma.Sql {
  const recordedAt = Prisma.sql`p.recorded_at`;
  const sums = buckets.map(
    (bucket) =>
      Prisma.sql`COALESCE(SUM(${NET_RENTAL}) FILTER (WHERE ${within(recordedAt, bucket)}), 0)`,
  );
  const span = { start: previous.start, end: buckets.at(-1)?.end ?? previous.end };
  return Prisma.sql`
    SELECT
      ARRAY[${Prisma.join(sums)}]::bigint[] AS amounts,
      COALESCE(SUM(${NET_RENTAL}) FILTER (WHERE ${within(recordedAt, previous)}), 0)::bigint AS previous
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.agency_id = ${agencyId}
      AND p.kind IN ('RENTAL', 'REFUND')
      AND ${within(recordedAt, span)}`;
}

export interface ActivityExpenseRow {
  amount: bigint;
  previous: bigint;
  agency: bigint;
}

/** Dépenses de la période, de la période précédente, et la part « toute l'agence ». */
export function activityExpenseQuery(
  agencyId: string,
  current: Period,
  previous: Period,
): Prisma.Sql {
  const spentOn = Prisma.sql`e.spent_on`;
  const span = { start: previous.start, end: current.end };
  return Prisma.sql`
    SELECT
      COALESCE(SUM(e.amount_millimes) FILTER (WHERE ${within(spentOn, current)}), 0)::bigint AS amount,
      COALESCE(SUM(e.amount_millimes) FILTER (WHERE ${within(spentOn, previous)}), 0)::bigint AS previous,
      COALESCE(SUM(e.amount_millimes) FILTER (
        WHERE e.vehicle_id IS NULL AND ${within(spentOn, current)}
      ), 0)::bigint AS agency
    FROM agency_expenses e
    WHERE e.agency_id = ${agencyId}
      AND ${within(spentOn, span)}`;
}

export interface ActivityVehicleSqlRow {
  id: string;
  brand: string;
  model: string;
  plate: string | null;
  archived: boolean;
  revenue: bigint;
  expenses: bigint;
  rented_seconds: number;
}

/**
 * Chaque voiture encore en flotte, plus celles retirées qui ont un encaissement, une dépense
 * ou du temps loué sur la période.
 */
export function activityVehiclesQuery(agencyId: string, period: Period): Prisma.Sql {
  return Prisma.sql`
    SELECT
      v.id,
      v.brand,
      v.model,
      COALESCE(v.plate_number, v.retired_plate_number) AS plate,
      (v.deleted_at IS NOT NULL) AS archived,
      COALESCE(pay.revenue, 0)::bigint AS revenue,
      COALESCE(cost.expenses, 0)::bigint AS expenses,
      COALESCE(use.rented_seconds, 0)::float8 AS rented_seconds
    FROM vehicles v
    LEFT JOIN (
      SELECT b.vehicle_id, SUM(${NET_RENTAL}) AS revenue
      FROM payments p
      JOIN bookings b ON b.id = p.booking_id
      WHERE b.agency_id = ${agencyId}
        AND p.kind IN ('RENTAL', 'REFUND')
        AND ${within(Prisma.sql`p.recorded_at`, period)}
      GROUP BY b.vehicle_id
    ) pay ON pay.vehicle_id = v.id
    LEFT JOIN (
      SELECT e.vehicle_id, SUM(e.amount_millimes) AS expenses
      FROM agency_expenses e
      WHERE e.agency_id = ${agencyId}
        AND e.vehicle_id IS NOT NULL
        AND ${within(Prisma.sql`e.spent_on`, period)}
      GROUP BY e.vehicle_id
    ) cost ON cost.vehicle_id = v.id
    LEFT JOIN (
      SELECT
        b.vehicle_id,
        SUM(EXTRACT(EPOCH FROM (
          LEAST(b.return_at, ${at(period.end)}) - GREATEST(b.pickup_at, ${at(period.start)})
        ))) AS rented_seconds
      FROM bookings b
      WHERE b.agency_id = ${agencyId}
        AND ${statusIn(Prisma.sql`b.status`, RENTED_STATUSES)}
        AND b.return_at > ${at(period.start)}
        AND b.pickup_at < ${at(period.end)}
      GROUP BY b.vehicle_id
    ) use ON use.vehicle_id = v.id
    WHERE v.agency_id = ${agencyId}
      AND (
        v.deleted_at IS NULL
        OR pay.vehicle_id IS NOT NULL
        OR cost.vehicle_id IS NOT NULL
        OR use.vehicle_id IS NOT NULL
      )`;
}

/** Nombre de départs par tranche, et total de la période précédente. */
export function activityBookingQuery(
  agencyId: string,
  buckets: Period[],
  previous: Period,
): Prisma.Sql {
  const pickupAt = Prisma.sql`b.pickup_at`;
  const kept = statusIn(Prisma.sql`b.status`, ACTIVITY_STATUSES);
  const sums = buckets.map(
    (bucket) =>
      Prisma.sql`COALESCE(COUNT(*) FILTER (WHERE ${within(pickupAt, bucket)} AND ${kept}), 0)`,
  );
  const span = { start: previous.start, end: buckets.at(-1)?.end ?? previous.end };
  return Prisma.sql`
    SELECT
      ARRAY[${Prisma.join(sums)}]::int[] AS counts,
      COALESCE(COUNT(*) FILTER (WHERE ${within(pickupAt, previous)} AND ${kept}), 0)::int AS previous
    FROM bookings b
    WHERE b.agency_id = ${agencyId}
      AND ${within(pickupAt, span)}`;
}

export interface RevenueRow {
  months: bigint[];
  previous_to_date: bigint;
}

/** Encaissements nets par mois (dans l'ordre de `months`) et du mois précédent à date. */
export function revenueQuery(
  agencyId: string,
  months: Period[],
  previousToDate: Period,
): Prisma.Sql {
  const recordedAt = Prisma.sql`p.recorded_at`;
  const sums = months.map(
    (month) =>
      Prisma.sql`COALESCE(SUM(${NET_RENTAL}) FILTER (WHERE ${within(recordedAt, month)}), 0)`,
  );
  const first = months[0]?.start ?? previousToDate.start;
  const last = months.at(-1)?.end ?? previousToDate.end;
  return Prisma.sql`
    SELECT
      ARRAY[${Prisma.join(sums)}]::bigint[] AS months,
      COALESCE(SUM(${NET_RENTAL}) FILTER (WHERE ${within(recordedAt, previousToDate)}), 0)::bigint AS previous_to_date
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.agency_id = ${agencyId}
      AND p.kind IN ('RENTAL', 'REFUND')
      AND ${within(recordedAt, { start: first, end: last })}`;
}

export interface OutstandingRow {
  outstanding: bigint;
}

/** Reste à encaisser sur les locations effectuées (jamais négatif par réservation). */
export function outstandingQuery(agencyId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT COALESCE(SUM(GREATEST(0, b.total_millimes - COALESCE(paid.net, 0))), 0)::bigint AS outstanding
    FROM bookings b
    LEFT JOIN LATERAL (
      SELECT SUM(${NET_RENTAL}) AS net FROM payments p WHERE p.booking_id = b.id
    ) paid ON true
    WHERE b.agency_id = ${agencyId}
      AND ${statusIn(Prisma.sql`b.status`, RENTED_STATUSES)}`;
}

export interface PaymentSummaryRow {
  collected_month: bigint;
  refunded_month: bigint;
  deposits_held: bigint;
  /** Encaissements de location du mois, dans l'ordre de `PAYMENT_METHODS`. */
  by_method: bigint[];
}

export function paymentSummaryQuery(agencyId: string, month: Period): Prisma.Sql {
  const inMonth = within(Prisma.sql`p.recorded_at`, month);
  const byMethod = PAYMENT_METHODS.map(
    (method) =>
      Prisma.sql`COALESCE(SUM(p.amount_millimes) FILTER (WHERE p.kind = 'RENTAL' AND p.method = ${method}::"PaymentMethod" AND ${inMonth}), 0)`,
  );
  return Prisma.sql`
    SELECT
      COALESCE(SUM(${NET_RENTAL}) FILTER (WHERE ${inMonth}), 0)::bigint AS collected_month,
      COALESCE(SUM(p.amount_millimes) FILTER (WHERE p.kind = 'REFUND' AND ${inMonth}), 0)::bigint AS refunded_month,
      COALESCE(SUM(${NET_DEPOSIT}), 0)::bigint AS deposits_held,
      ARRAY[${Prisma.join(byMethod)}]::bigint[] AS by_method
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.agency_id = ${agencyId}`;
}

// --- Clients de l'agence ---------------------------------------------------------------

/** Conditions de recherche sur `users u`, à ajouter après un `WHERE`. */
export function customerSearchSql(search: string): Prisma.Sql {
  const terms = searchTerms(search);
  if (terms.length === 0) {
    return Prisma.empty;
  }
  const conditions = terms.map((term) => {
    const digits = phoneDigits(term);
    const phone =
      digits === null ? Prisma.empty : Prisma.sql` OR u.phone LIKE ${containsPattern(digits)}`;
    return Prisma.sql`(${folded(CUSTOMER_NAME, term)} OR ${folded(CUSTOMER_CONTACT, term)}${phone})`;
  });
  return Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`;
}

export interface CountRow {
  total: number;
}

export function customerCountQuery(agencyId: string, search: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(DISTINCT b.customer_id)::int AS total
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    WHERE b.agency_id = ${agencyId} ${search}`;
}

export interface CustomerPageRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  created_at: Date;
  bookings_count: number;
  completed_count: number;
  last_booking_at: Date;
  total_spent: bigint;
}

/**
 * Page de clients triée par dernière réservation ; le total encaissé n'est calculé que pour
 * les clients de la page.
 */
export function customerPageQuery(
  agencyId: string,
  search: Prisma.Sql,
  page: { skip: number; take: number },
): Prisma.Sql {
  return Prisma.sql`
    WITH page AS (
      SELECT
        u.id, u.first_name, u.last_name, u.phone, u.email, u.city, u.created_at,
        COUNT(*)::int AS bookings_count,
        COUNT(*) FILTER (WHERE b.status = 'COMPLETED')::int AS completed_count,
        MAX(b.pickup_at) AS last_booking_at
      FROM bookings b
      JOIN users u ON u.id = b.customer_id
      WHERE b.agency_id = ${agencyId} ${search}
      GROUP BY u.id
      ORDER BY last_booking_at DESC, u.id ASC
      LIMIT ${page.take} OFFSET ${page.skip}
    )
    SELECT page.*, COALESCE((
      SELECT SUM(${NET_RENTAL})
      FROM payments p
      JOIN bookings pb ON pb.id = p.booking_id
      WHERE pb.agency_id = ${agencyId} AND pb.customer_id = page.id
    ), 0)::bigint AS total_spent
    FROM page
    ORDER BY page.last_booking_at DESC, page.id ASC`;
}

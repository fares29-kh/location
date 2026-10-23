import { randomInt, randomUUID } from 'node:crypto';

import {
  addDays,
  addMonths,
  AGENCY_LIST_LIMIT_DEFAULT,
  type AgencyProfile,
  type AgencySettings,
  applyBookingAction,
  BLOCKING_BOOKING_STATUSES,
  BOOKING_FILTER_STATUSES,
  type BookingFilter,
  type BookingList,
  type BookingQuery,
  type BookingTransitionInput,
  type BookingView,
  type DeskBookingInput,
  canApplyBookingAction,
  type CustomerDetail,
  type CustomerQuery,
  type CustomerView,
  type ActivityReport,
  type DashboardData,
  type DashboardReportQuery,
  type NavCounts,
  normalizeTunisianPhone,
  type Paginated,
  PAYMENT_METHODS,
  type PaymentList,
  type PaymentMethod,
  type PaymentQuery,
  type PlanningData,
  isoWeekday,
  rentalPriceMillimes,
  rentalWindow,
  type ReportGrain,
  type RecordPaymentInput,
  type RentalConditions,
  type Review,
  type ReviewList,
  type ReviewReportInput,
  type ReviewQuery,
  todayKey,
  toE164,
  toMonthKey,
  tunisDateTime,
  type VehicleInput,
  type VehicleMaintenance,
  type VehicleMaintenanceRequest,
  type VehicleStatus,
  type VehicleView,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { AppException } from '../common/errors/app.exception';
import { pageWindow, toPaginated } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VEHICLE_PHOTOS_INCLUDE, vehiclePhotoKeys } from '../storage/vehicle-photos';
import {
  type BookingRefRow,
  nextBookingRef,
  toBookingView,
  toCustomer,
  toCustomerView,
  toMaintenance,
  toPlanningBooking,
  toReview,
  toSettings,
  toVehicle,
  toVehicleView,
} from './agency.mapper';
import {
  BOOKING_REF_INCLUDE,
  BOOKING_VIEW_INCLUDE,
  type BookingKpisRow,
  bookingKpisQuery,
  bookingPageQuery,
  bookingSearchSql,
  bookingStatusCountsQuery,
  ACTIVITY_STATUSES,
  activityBookingQuery,
  activityRevenueQuery,
  type ActivityAmountRow,
  type ActivityCountRow,
  type CountRow,
  CUSTOMER_SELECT,
  customerCountQuery,
  type CustomerPageRow,
  customerPageQuery,
  customerSearchSql,
  fleetOccupancyQuery,
  fleetQuery,
  type FleetRow,
  type IdRow,
  nextBookingsQuery,
  type NextBookingRow,
  OCCUPANCY_WINDOW_MS,
  type OccupancyRow,
  outstandingQuery,
  type OutstandingRow,
  paymentSummaryQuery,
  type PaymentSummaryRow,
  paymentWhere,
  PLANNING_BOOKING_SELECT,
  PLANNING_STATUSES,
  REVIEW_INCLUDE,
  reviewFilterWhere,
  revenueQuery,
  type RevenueRow,
  type Period,
  startOfDay,
  startOfMonth,
  type StatusCountRow,
  VEHICLE_CATEGORY_INCLUDE,
  vehicleStatsQuery,
  type VehicleStatsRow,
  VISIBLE_REVIEW,
} from './agency.queries';
import type { PlanningWindow } from './planning-window';

const VEHICLE_COLORS = ['#2563EB', '#059669', '#DC2626', '#F59E0B', '#334155', '#7C3AED'];
const DEFAULT_GOVERNORATE = '11';
const DASHBOARD_PENDING = 5;
const NAV_LATEST_PENDING = 5;
const REVENUE_MONTHS = 6;
const REPORT_LINE_LIMIT = 80;

function daysInMonth(monthKey: string): number {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function periodBounds(buckets: { period: Period }[]): Period {
  const first = buckets[0];
  const last = buckets.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error('Période de rapport vide');
  }
  return { start: first.period.start, end: last.period.end };
}

/** Tranches de la période affichée, et la période précédente de même longueur. */
function reportWindows(
  grain: ReportGrain,
  anchor: string,
): {
  current: Period;
  previous: Period;
  buckets: { key: string; period: Period }[];
} {
  if (grain === 'day') {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      key: String(hour),
      period: {
        start: tunisDateTime(anchor, hour),
        end: hour === 23 ? tunisDateTime(addDays(anchor, 1), 0) : tunisDateTime(anchor, hour + 1),
      },
    }));
    const previousDay = addDays(anchor, -1);
    return {
      current: { start: tunisDateTime(anchor, 0), end: tunisDateTime(addDays(anchor, 1), 0) },
      previous: {
        start: tunisDateTime(previousDay, 0),
        end: tunisDateTime(anchor, 0),
      },
      buckets,
    };
  }
  if (grain === 'week') {
    const startDay = addDays(anchor, -isoWeekday(anchor));
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(startDay, index);
      return {
        key: day,
        period: { start: startOfDay(day), end: startOfDay(addDays(day, 1)) },
      };
    });
    const previousStart = addDays(startDay, -7);
    const current = periodBounds(buckets);
    return {
      current,
      previous: { start: startOfDay(previousStart), end: current.start },
      buckets,
    };
  }
  if (grain === 'month') {
    const month = anchor.slice(0, 7);
    const count = daysInMonth(month);
    const buckets = Array.from({ length: count }, (_, index) => {
      const day = `${month}-${String(index + 1).padStart(2, '0')}`;
      return {
        key: day,
        period: { start: startOfDay(day), end: startOfDay(addDays(day, 1)) },
      };
    });
    const previousMonth = addMonths(month, -1);
    return {
      current: periodBounds(buckets),
      previous: {
        start: startOfMonth(previousMonth),
        end: startOfMonth(month),
      },
      buckets,
    };
  }
  const year = anchor.slice(0, 4);
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    return {
      key: month,
      period: { start: startOfMonth(month), end: startOfMonth(addMonths(month, 1)) },
    };
  });
  const previousYear = String(Number(year) - 1);
  const current = periodBounds(buckets);
  return {
    current,
    previous: {
      start: startOfMonth(`${previousYear}-01`),
      end: current.start,
    },
    buckets,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newReference(): string {
  return `DTN-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET.charAt(randomInt(REFERENCE_ALPHABET.length))).join('')}`;
}

function plateAlreadyUsed(): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Immatriculation déjà utilisée.', [
    { path: 'plateNumber', message: 'PLATE_ALREADY_USED' },
  ]);
}

/** Les agrégats sans `GROUP BY` renvoient toujours exactement une ligne. */
function single<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error('Agrégat SQL sans résultat');
  }
  return row;
}

function firstByVehicle(rows: BookingRefRow[]): Map<string, BookingRefRow> {
  const map = new Map<string, BookingRefRow>();
  for (const row of rows) {
    if (!map.has(row.vehicleId)) {
      map.set(row.vehicleId, row);
    }
  }
  return map;
}

/** Ordre d'affichage de la flotte, indépendant de la collation de la base. */
function byVehicleName<T extends { brand: string; model: string }>(a: T, b: T): number {
  return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
}

function byDate<T extends { id: string }>(date: (row: T) => Date) {
  return (a: T, b: T): number =>
    date(a).getTime() - date(b).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Portail agence : chaque lecture est une requête ciblée sur l'agence du propriétaire connecté.
 * Filtres, tris, pagination et agrégats sont calculés par PostgreSQL ; les requêtes
 * indépendantes d'un même écran partagent une seule connexion du pool.
 */
@Injectable()
export class AgencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly catalog: CatalogService,
  ) {}

  /** Agence du propriétaire, créée à la première connexion à partir de son compte. */
  async agencyIdFor(ownerId: string): Promise<string> {
    const existing = await this.prisma.agency.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (existing !== null) {
      return existing.id;
    }
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    const phone = normalizeTunisianPhone(owner.phone);
    try {
      const agency = await this.prisma.agency.create({
        data: {
          ownerId,
          name: `${owner.firstName} ${owner.lastName}`,
          phone,
          whatsappPhone: phone,
          email: owner.email,
          address: '',
          governorateCode: DEFAULT_GOVERNORATE,
        },
        select: { id: true },
      });
      await this.audit.log({
        action: 'agency.created',
        actorId: ownerId,
        entityType: 'agency',
        entityId: agency.id,
      });
      return agency.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return (await this.prisma.agency.findUniqueOrThrow({ where: { ownerId } })).id;
      }
      throw error;
    }
  }

  private publicUrl(): (key: string) => string {
    return (key) => this.storage.publicUrl(key);
  }

  private async bookingView(ownerId: string, bookingId: string): Promise<BookingView> {
    const agencyId = await this.agencyIdFor(ownerId);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, agencyId },
      include: BOOKING_VIEW_INCLUDE,
    });
    if (booking === null) {
      throw new NotFoundException('Réservation introuvable.');
    }
    return toBookingView(booking, this.publicUrl());
  }

  /** Vues de la flotte (ou d'un seul véhicule) avec locations en cours, à venir et stats 30 j. */
  private async vehicleViews(agencyId: string, vehicleId?: string): Promise<VehicleView[]> {
    const now = new Date();
    const since = new Date(now.getTime() - OCCUPANCY_WINDOW_MS);
    const bookingScope = vehicleId === undefined ? { agencyId } : { agencyId, vehicleId };
    const [vehicles, current, upcoming, stats] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where:
          vehicleId === undefined
            ? { agencyId, deletedAt: null }
            : { agencyId, id: vehicleId, deletedAt: null },
        include: { photos: VEHICLE_PHOTOS_INCLUDE, category: VEHICLE_CATEGORY_INCLUDE },
        orderBy: { id: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: { ...bookingScope, status: 'PICKED_UP' },
        include: BOOKING_REF_INCLUDE,
        orderBy: { id: 'asc' },
      }),
      this.prisma.$queryRaw<NextBookingRow[]>(nextBookingsQuery(agencyId, now, vehicleId)),
      this.prisma.$queryRaw<VehicleStatsRow[]>(vehicleStatsQuery(agencyId, now, since, vehicleId)),
    ]);

    const currentByVehicle = firstByVehicle(current);
    const nextByVehicle = new Map(upcoming.map((row) => [row.vehicle_id, nextBookingRef(row)]));
    const statsByVehicle = new Map(stats.map((row) => [row.vehicle_id, row]));
    const publicUrl = this.publicUrl();
    return vehicles.sort(byVehicleName).map((vehicle) => {
      const row = statsByVehicle.get(vehicle.id);
      return toVehicleView(
        vehicle,
        {
          currentBooking: currentByVehicle.get(vehicle.id) ?? null,
          nextBooking: nextByVehicle.get(vehicle.id) ?? null,
          occupancyRate: Math.min(1, ((row?.rented_seconds ?? 0) * 1000) / OCCUPANCY_WINDOW_MS),
          revenue30dMillimes: Number(row?.revenue ?? 0),
        },
        publicUrl,
      );
    });
  }

  private async vehicleView(ownerId: string, vehicleId: string): Promise<VehicleView> {
    const agencyId = await this.agencyIdFor(ownerId);
    const [view] = await this.vehicleViews(agencyId, vehicleId);
    if (view === undefined) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    return view;
  }

  private async ownedBooking(ownerId: string, bookingId: string) {
    const agencyId = await this.agencyIdFor(ownerId);
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, agencyId } });
    if (booking === null) {
      throw new NotFoundException('Réservation introuvable.');
    }
    return booking;
  }

  private async ownedVehicle(ownerId: string, vehicleId: string) {
    const agencyId = await this.agencyIdFor(ownerId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, agencyId, deletedAt: null },
    });
    if (vehicle === null) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    return vehicle;
  }

  // --- Lectures -------------------------------------------------------------------

  /**
   * Huit requêtes regroupées dans une transaction en lecture : une seule connexion du pool
   * par affichage, et des indicateurs cohérents entre eux (même instantané).
   */
  async getDashboard(ownerId: string): Promise<DashboardData> {
    const agencyId = await this.agencyIdFor(ownerId);
    const now = new Date();
    const today = todayKey(now);
    const month = toMonthKey(now);
    const previousMonth = addMonths(month, -1);
    const monthStart = startOfMonth(month);
    const todayStart = startOfDay(today);
    const tomorrowStart = startOfDay(addDays(today, 1));
    // Mois en cours et mois précédent jusqu'au même quantième, pour une comparaison à date.
    const monthToDate = { start: monthStart, end: tomorrowStart };
    const previousToDate = {
      start: startOfMonth(previousMonth),
      end: new Date(
        Math.min(
          startOfDay(addDays(`${previousMonth}-01`, Number(today.slice(8, 10)))).getTime(),
          monthStart.getTime(),
        ),
      ),
    };
    const months = Array.from({ length: REVENUE_MONTHS }, (_, index) =>
      addMonths(month, index - (REVENUE_MONTHS - 1)),
    );

    const [kpis, fleet, occupancy, revenue, outstanding, rating, pending, todayRows] =
      await this.prisma.$transaction(
        [
          this.prisma.$queryRaw<BookingKpisRow[]>(
            bookingKpisQuery(agencyId, monthToDate, previousToDate),
          ),
          this.prisma.$queryRaw<FleetRow[]>(fleetQuery(agencyId)),
          this.prisma.$queryRaw<OccupancyRow[]>(
            fleetOccupancyQuery(agencyId, now, new Date(now.getTime() - OCCUPANCY_WINDOW_MS)),
          ),
          this.prisma.$queryRaw<RevenueRow[]>(
            revenueQuery(
              agencyId,
              months.map((key) => ({
                start: startOfMonth(key),
                end: startOfMonth(addMonths(key, 1)),
              })),
              previousToDate,
            ),
          ),
          this.prisma.$queryRaw<OutstandingRow[]>(outstandingQuery(agencyId)),
          this.prisma.review.aggregate({
            where: { agencyId, ...VISIBLE_REVIEW },
            _avg: { rating: true },
            _count: true,
          }),
          this.prisma.booking.findMany({
            where: { agencyId, status: 'PENDING' },
            include: BOOKING_VIEW_INCLUDE,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: DASHBOARD_PENDING,
          }),
          this.prisma.booking.findMany({
            where: {
              agencyId,
              OR: [
                {
                  status: { in: ['CONFIRMED', 'PICKED_UP'] },
                  pickupAt: { gte: todayStart, lt: tomorrowStart },
                },
                {
                  status: { in: ['PICKED_UP', 'RETURNED', 'COMPLETED'] },
                  returnAt: { gte: todayStart, lt: tomorrowStart },
                },
              ],
            },
            include: BOOKING_VIEW_INCLUDE,
            orderBy: { id: 'asc' },
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );

    const bookingKpis = single(kpis);
    const fleetCounts = single(fleet);
    const revenueRow = single(revenue);
    const monthly = revenueRow.months.map(Number);
    const publicUrl = this.publicUrl();
    const isToday = (date: Date) => date >= todayStart && date < tomorrowStart;

    return {
      kpis: {
        revenueMonthMillimes: monthly.at(-1) ?? 0,
        revenuePreviousMonthMillimes: Number(revenueRow.previous_to_date),
        bookingsMonth: bookingKpis.bookings_month,
        bookingsPreviousMonth: bookingKpis.bookings_previous_month,
        occupancyRate:
          fleetCounts.active === 0
            ? 0
            : Math.min(
                1,
                (single(occupancy).rented_seconds * 1000) /
                  (fleetCounts.active * OCCUPANCY_WINDOW_MS),
              ),
        outstandingMillimes: Number(single(outstanding).outstanding),
      },
      pending: pending.map((row) => toBookingView(row, publicUrl)),
      pendingCount: bookingKpis.pending_count,
      departuresToday: todayRows
        .filter(
          (row) =>
            (row.status === 'CONFIRMED' || row.status === 'PICKED_UP') && isToday(row.pickupAt),
        )
        .sort(byDate((row) => row.pickupAt))
        .map((row) => toBookingView(row, publicUrl)),
      returnsToday: todayRows
        .filter(
          (row) =>
            (row.status === 'PICKED_UP' ||
              row.status === 'RETURNED' ||
              row.status === 'COMPLETED') &&
            isToday(row.returnAt),
        )
        .sort(byDate((row) => row.returnAt))
        .map((row) => toBookingView(row, publicUrl)),
      revenueByMonth: months.map((key, index) => ({
        month: key,
        amountMillimes: monthly[index] ?? 0,
      })),
      fleet: {
        available: fleetCounts.active - fleetCounts.on_rent,
        onRent: fleetCounts.on_rent,
        maintenance: fleetCounts.maintenance,
        inactive: fleetCounts.inactive,
      },
      rating: { average: rating._avg.rating ?? 0, count: rating._count },
    };
  }

  /** Encaissements et départs d'une journée, d'une semaine, d'un mois ou d'une année. */
  async getActivityReport(ownerId: string, query: DashboardReportQuery): Promise<ActivityReport> {
    const agencyId = await this.agencyIdFor(ownerId);
    const today = todayKey();
    const anchor = query.anchor === undefined || query.anchor > today ? today : query.anchor;
    const { current, previous, buckets } = reportWindows(query.grain, anchor);
    const [agency, revenueRows, bookingRows, lines] = await this.prisma.$transaction([
      this.prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { name: true } }),
      this.prisma.$queryRaw<ActivityAmountRow[]>(
        activityRevenueQuery(
          agencyId,
          buckets.map((bucket) => bucket.period),
          previous,
        ),
      ),
      this.prisma.$queryRaw<ActivityCountRow[]>(
        activityBookingQuery(
          agencyId,
          buckets.map((bucket) => bucket.period),
          previous,
        ),
      ),
      this.prisma.booking.findMany({
        where: {
          agencyId,
          pickupAt: { gte: current.start, lt: current.end },
          status: { in: [...ACTIVITY_STATUSES] },
        },
        select: {
          reference: true,
          status: true,
          pickupAt: true,
          returnAt: true,
          totalMillimes: true,
          customer: { select: { firstName: true, lastName: true } },
          vehicle: {
            select: { brand: true, model: true, plateNumber: true, retiredPlateNumber: true },
          },
        },
        orderBy: [{ pickupAt: 'asc' }, { id: 'asc' }],
        take: REPORT_LINE_LIMIT + 1,
      }),
    ]);
    const revenue = single(revenueRows);
    const departures = single(bookingRows);
    const amounts = revenue.amounts.map(Number);
    const counts = departures.counts.map(Number);
    const shown = lines.slice(0, REPORT_LINE_LIMIT);
    return {
      agencyName: agency.name,
      grain: query.grain,
      from: current.start.toISOString(),
      to: current.end.toISOString(),
      revenueMillimes: amounts.reduce((sum, value) => sum + value, 0),
      previousRevenueMillimes: Number(revenue.previous),
      bookings: counts.reduce((sum, value) => sum + value, 0),
      previousBookings: departures.previous,
      series: buckets.map((bucket, index) => ({
        key: bucket.key,
        revenueMillimes: amounts[index] ?? 0,
        bookings: counts[index] ?? 0,
      })),
      lines: shown.map((line) => ({
        reference: line.reference,
        customer: `${line.customer.firstName} ${line.customer.lastName}`.trim(),
        vehicle:
          (line.vehicle.plateNumber ?? line.vehicle.retiredPlateNumber)
            ? `${line.vehicle.brand} ${line.vehicle.model} · ${line.vehicle.plateNumber ?? line.vehicle.retiredPlateNumber}`
            : `${line.vehicle.brand} ${line.vehicle.model}`,
        pickupAt: line.pickupAt.toISOString(),
        returnAt: line.returnAt.toISOString(),
        status: line.status,
        totalMillimes: line.totalMillimes,
      })),
      truncated: lines.length > REPORT_LINE_LIMIT,
    };
  }

  async getNavCounts(ownerId: string): Promise<NavCounts> {
    const agencyId = await this.agencyIdFor(ownerId);
    const [pendingBookings, unansweredReviews, latestPending] = await this.prisma.$transaction([
      this.prisma.booking.count({ where: { agencyId, status: 'PENDING' } }),
      this.prisma.review.count({ where: { agencyId, reply: null, ...VISIBLE_REVIEW } }),
      this.prisma.booking.findMany({
        where: { agencyId, status: 'PENDING' },
        include: BOOKING_VIEW_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: NAV_LATEST_PENDING,
      }),
    ]);
    const publicUrl = this.publicUrl();
    return {
      pendingBookings,
      unansweredReviews,
      latestPending: latestPending.map((row) => toBookingView(row, publicUrl)),
    };
  }

  async listBookings(ownerId: string, query: BookingQuery): Promise<BookingList> {
    const agencyId = await this.agencyIdFor(ownerId);
    const search = bookingSearchSql(agencyId, query.search);

    const groups = await this.prisma.$queryRaw<StatusCountRow[]>(
      bookingStatusCountsQuery(agencyId, search),
    );
    const counts: Record<BookingFilter, number> = {
      all: 0,
      pending: 0,
      confirmed: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const group of groups) {
      counts.all += group.count;
      for (const [filter, statuses] of Object.entries(BOOKING_FILTER_STATUSES)) {
        if (statuses.includes(group.status)) {
          counts[filter as Exclude<BookingFilter, 'all'>] += group.count;
        }
      }
    }

    const total = counts[query.filter];
    const window = pageWindow(total, query.page, query.limit ?? AGENCY_LIST_LIMIT_DEFAULT);
    const ids =
      total === 0
        ? []
        : (
            await this.prisma.$queryRaw<IdRow[]>(bookingPageQuery(agencyId, search, query, window))
          ).map((row) => row.id);
    const rows =
      ids.length === 0
        ? []
        : await this.prisma.booking.findMany({
            where: { id: { in: ids }, agencyId },
            include: BOOKING_VIEW_INCLUDE,
          });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const publicUrl = this.publicUrl();
    return {
      ...toPaginated(
        ids.flatMap((id) => {
          const row = byId.get(id);
          return row === undefined ? [] : [toBookingView(row, publicUrl)];
        }),
        total,
        window,
      ),
      counts,
    };
  }

  getBooking(ownerId: string, bookingId: string): Promise<BookingView> {
    return this.bookingView(ownerId, bookingId);
  }

  /** Réservations qui chevauchent la fenêtre [start, end[ (minuits de Tunis), en version allégée. */
  async getPlanning(ownerId: string, window: PlanningWindow): Promise<PlanningData> {
    const agencyId = await this.agencyIdFor(ownerId);
    const [vehicles, bookings, maintenances] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where: { agencyId, deletedAt: null, status: { not: 'INACTIVE' } },
        include: {
          photos: { ...VEHICLE_PHOTOS_INCLUDE, take: 1 },
          category: VEHICLE_CATEGORY_INCLUDE,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          agencyId,
          status: { in: PLANNING_STATUSES },
          pickupAt: { lt: window.end },
          returnAt: { gt: window.start },
        },
        select: PLANNING_BOOKING_SELECT,
        orderBy: [{ pickupAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.vehicleMaintenance.findMany({
        where: {
          vehicle: { agencyId },
          startsAt: { lt: window.end },
          endsAt: { gt: window.start },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const publicUrl = this.publicUrl();
    return {
      from: window.from,
      to: window.to,
      days: window.days,
      vehicles: vehicles.sort(byVehicleName).map((vehicle) => toVehicle(vehicle, publicUrl)),
      bookings: bookings.map(toPlanningBooking),
      maintenances: maintenances.map(toMaintenance),
    };
  }

  async listVehicles(ownerId: string): Promise<VehicleView[]> {
    return this.vehicleViews(await this.agencyIdFor(ownerId));
  }

  async listCustomers(ownerId: string, query: CustomerQuery): Promise<Paginated<CustomerView>> {
    const agencyId = await this.agencyIdFor(ownerId);
    const search = customerSearchSql(query.search);
    const { total } = single(
      await this.prisma.$queryRaw<CountRow[]>(customerCountQuery(agencyId, search)),
    );
    const window = pageWindow(total, query.page, query.limit ?? AGENCY_LIST_LIMIT_DEFAULT);
    const rows =
      total === 0
        ? []
        : await this.prisma.$queryRaw<CustomerPageRow[]>(
            customerPageQuery(agencyId, search, window),
          );
    return toPaginated(rows.map(toCustomerView), total, window);
  }

  async getCustomer(ownerId: string, customerId: string): Promise<CustomerDetail> {
    const agencyId = await this.agencyIdFor(ownerId);
    const customer = await this.prisma.user.findFirst({
      where: { id: customerId, bookings: { some: { agencyId } } },
      select: {
        ...CUSTOMER_SELECT,
        bookings: {
          where: { agencyId },
          include: BOOKING_VIEW_INCLUDE,
          orderBy: [{ pickupAt: 'desc' }, { id: 'asc' }],
        },
      },
    });
    if (customer === null) {
      throw new NotFoundException('Client introuvable.');
    }
    const publicUrl = this.publicUrl();
    const bookings = customer.bookings.map((row) => toBookingView(row, publicUrl));
    return {
      ...toCustomer(customer),
      bookingsCount: bookings.length,
      completedCount: bookings.filter((booking) => booking.status === 'COMPLETED').length,
      totalSpentMillimes: bookings.reduce(
        (total, booking) => total + booking.payment.paidMillimes,
        0,
      ),
      lastBookingAt: bookings[0]?.pickupAt ?? null,
      bookings,
    };
  }

  async listPayments(ownerId: string, query: PaymentQuery): Promise<PaymentList> {
    const agencyId = await this.agencyIdFor(ownerId);
    const month = toMonthKey(new Date());
    const where = paymentWhere(agencyId, query);
    const total = await this.prisma.payment.count({ where });
    const window = pageWindow(total, query.page, query.limit ?? AGENCY_LIST_LIMIT_DEFAULT);
    const [rows, summary, outstanding] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              reference: true,
              customer: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }],
        skip: window.skip,
        take: window.take,
      }),
      this.prisma.$queryRaw<PaymentSummaryRow[]>(
        paymentSummaryQuery(agencyId, {
          start: startOfMonth(month),
          end: startOfMonth(addMonths(month, 1)),
        }),
      ),
      this.prisma.$queryRaw<OutstandingRow[]>(outstandingQuery(agencyId)),
    ]);

    const totals = single(summary);
    const byMethod = Object.fromEntries(
      PAYMENT_METHODS.map((method, index) => [method, Number(totals.by_method[index] ?? 0)]),
    ) as Record<PaymentMethod, number>;
    return {
      ...toPaginated(
        rows.map((row) => ({
          id: row.id,
          bookingId: row.bookingId,
          kind: row.kind,
          method: row.method,
          amountMillimes: row.amountMillimes,
          recordedAt: row.recordedAt.toISOString(),
          note: row.note,
          bookingReference: row.booking.reference,
          customerName: `${row.booking.customer.firstName} ${row.booking.customer.lastName}`,
        })),
        total,
        window,
      ),
      summary: {
        collectedMonthMillimes: Number(totals.collected_month),
        refundedMonthMillimes: Number(totals.refunded_month),
        outstandingMillimes: Number(single(outstanding).outstanding),
        depositsHeldMillimes: Number(totals.deposits_held),
        byMethod,
      },
    };
  }

  /** Page d'avis filtrés ; note moyenne, compteurs et répartition portent sur tous les avis visibles. */
  async listReviews(ownerId: string, query: ReviewQuery): Promise<ReviewList> {
    const agencyId = await this.agencyIdFor(ownerId);
    const visible = { agencyId, ...VISIBLE_REVIEW };
    const where = { ...visible, ...reviewFilterWhere(query.filter) };
    const ratingGroups = this.prisma.review.groupBy({
      by: ['rating'],
      where: visible,
      orderBy: { rating: 'asc' },
      _count: { _all: true },
    });
    const [total, stats, unansweredCount, ratings] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where: visible, _avg: { rating: true }, _count: true }),
      this.prisma.review.count({ where: { ...visible, reply: null } }),
      ratingGroups,
    ]);
    const window = pageWindow(total, query.page, query.limit ?? AGENCY_LIST_LIMIT_DEFAULT);
    const rows =
      total === 0
        ? []
        : await this.prisma.review.findMany({
            where,
            include: REVIEW_INCLUDE,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: window.skip,
            take: window.take,
          });
    const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const group of ratings) {
      if (group.rating >= 1 && group.rating <= 5) {
        distribution[group.rating - 1] = group._count._all;
      }
    }
    return {
      ...toPaginated(rows.map(toReview), total, window),
      average: stats._avg.rating ?? 0,
      count: stats._count,
      unansweredCount,
      distribution,
    };
  }

  async getSettings(ownerId: string): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    return toSettings(
      await this.prisma.agency.findUniqueOrThrow({ where: { id: agencyId } }),
      this.publicUrl(),
    );
  }

  // --- Réservations et encaissements ----------------------------------------------

  /**
   * Réservation prise au comptoir. Confirmée immédiatement : elle bloque le véhicule
   * comme une demande en ligne. Un numéro déjà client est repris ; un numéro nouveau
   * crée un compte client que la personne pourra terminer plus tard.
   */
  async createDeskBooking(
    ownerId: string,
    input: DeskBookingInput,
    ip: string | null,
  ): Promise<BookingView> {
    if (input.pickup < todayKey()) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Date passée.', [
        { path: 'pickup', message: 'PAST_DATE' },
      ]);
    }
    const agencyId = await this.agencyIdFor(ownerId);
    const agency = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: { id: true, address: true, status: true },
    });
    const customer = await this.deskCustomer(input);
    const place = { fr: agency.address, ar: agency.address, en: agency.address };
    const { pickupAt, returnAt, days } = rentalWindow(input.pickup, input.return);

    for (let attempt = 1; ; attempt += 1) {
      try {
        const booking = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${input.vehicleId} FOR UPDATE`;
          const vehicle = await tx.vehicle.findFirst({
            where: { id: input.vehicleId, agencyId: agency.id, deletedAt: null },
          });
          if (vehicle?.status !== 'ACTIVE' || agency.status !== 'ACTIVE') {
            throw new AppException(
              HttpStatus.CONFLICT,
              'VEHICLE_UNAVAILABLE',
              'Ce véhicule n’est plus disponible sur ces dates.',
            );
          }
          const overlapping = await tx.booking.count({
            where: {
              vehicleId: vehicle.id,
              status: { in: [...BLOCKING_BOOKING_STATUSES] },
              pickupAt: { lt: returnAt },
              returnAt: { gt: pickupAt },
            },
          });
          const maintenance = await tx.vehicleMaintenance.count({
            where: { vehicleId: vehicle.id, startsAt: { lt: returnAt }, endsAt: { gt: pickupAt } },
          });
          if (overlapping > 0 || maintenance > 0) {
            throw new AppException(
              HttpStatus.CONFLICT,
              'VEHICLE_UNAVAILABLE',
              'Ce véhicule n’est plus disponible sur ces dates.',
            );
          }
          return tx.booking.create({
            data: {
              reference: newReference(),
              agencyId: agency.id,
              vehicleId: vehicle.id,
              customerId: customer.id,
              pickupAt,
              returnAt,
              pickupPlace: place,
              returnPlace: place,
              status: 'CONFIRMED',
              dailyRateMillimes: vehicle.dailyRateMillimes,
              totalMillimes: rentalPriceMillimes(vehicle.dailyRateMillimes, days),
              depositMillimes: vehicle.depositMillimes,
              customerNote: input.note === undefined || input.note.length === 0 ? null : input.note,
              events: { create: [{ status: 'CONFIRMED', reason: null }] },
            },
            select: { id: true },
          });
        });
        await this.audit.log({
          action: 'booking.created',
          actorId: ownerId,
          entityType: 'booking',
          entityId: booking.id,
          metadata: { vehicleId: input.vehicleId, status: 'CONFIRMED', source: 'desk' },
          ip,
        });
        return await this.bookingView(ownerId, booking.id);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 5) {
          continue;
        }
        throw error;
      }
    }
  }

  /** Client du comptoir : fiche existante, ou compte à terminer plus tard par la personne. */
  private async deskCustomer(input: DeskBookingInput) {
    const phone = toE164(input.phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing !== null) {
      this.assertDeskCustomer(existing);
      return existing;
    }
    try {
      return await this.prisma.user.create({
        data: {
          role: 'CUSTOMER',
          status: 'PENDING_VERIFICATION',
          firstName: input.firstName,
          lastName: input.lastName,
          phone,
          locale: 'fr',
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const raced = await this.prisma.user.findUnique({ where: { phone } });
      if (raced === null) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'Ce numéro ne correspond pas à un client.',
          [{ path: 'phone', message: 'PHONE_NOT_CUSTOMER' }],
        );
      }
      this.assertDeskCustomer(raced);
      return raced;
    }
  }

  private assertDeskCustomer(existing: User) {
    if (existing.deletedAt !== null || existing.role !== 'CUSTOMER') {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Ce numéro ne correspond pas à un client.',
        [{ path: 'phone', message: 'PHONE_NOT_CUSTOMER' }],
      );
    }
    if (existing.status === 'SUSPENDED') {
      throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Ce compte client est suspendu.', [
        { path: 'phone', message: 'ACCOUNT_SUSPENDED' },
      ]);
    }
  }

  async transitionBooking(
    ownerId: string,
    bookingId: string,
    input: BookingTransitionInput,
    ip: string | null,
  ): Promise<BookingView> {
    const booking = await this.ownedBooking(ownerId, bookingId);
    if (!canApplyBookingAction(booking.status, input.action)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Cette action n’est plus possible pour cette réservation.',
      );
    }
    const status = applyBookingAction(booking.status, input.action);
    const updated = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status },
    });
    if (updated.count === 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'La réservation a été modifiée entre-temps.',
      );
    }
    await this.prisma.bookingEvent.create({
      data: { bookingId: booking.id, status, reason: input.reason ?? null, actorId: ownerId },
    });
    await this.audit.log({
      action: 'booking.status_changed',
      actorId: ownerId,
      entityType: 'booking',
      entityId: booking.id,
      metadata: { from: booking.status, to: status, action: input.action },
      ip,
    });
    return this.bookingView(ownerId, booking.id);
  }

  async recordPayment(
    ownerId: string,
    bookingId: string,
    input: RecordPaymentInput,
    ip: string | null,
  ): Promise<BookingView> {
    const booking = await this.ownedBooking(ownerId, bookingId);
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: input.kind,
        method: input.method,
        amountMillimes: input.amountMillimes,
        note: input.note === undefined || input.note.length === 0 ? null : input.note,
        recordedById: ownerId,
      },
    });
    await this.audit.log({
      action: 'payment.recorded',
      actorId: ownerId,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { bookingId: booking.id, kind: input.kind, amountMillimes: input.amountMillimes },
      ip,
    });
    return this.bookingView(ownerId, booking.id);
  }

  // --- Flotte ---------------------------------------------------------------------

  async createVehicle(ownerId: string, input: VehicleInput): Promise<VehicleView> {
    const agencyId = await this.agencyIdFor(ownerId);
    const data = await this.catalog.resolveVehicleInput(input);
    const count = await this.prisma.vehicle.count({ where: { agencyId, deletedAt: null } });
    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          ...data,
          agencyId,
          color: VEHICLE_COLORS[count % VEHICLE_COLORS.length] ?? '#2563EB',
        },
      });
      return await this.vehicleView(ownerId, vehicle.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw plateAlreadyUsed();
      }
      throw error;
    }
  }

  async updateVehicle(
    ownerId: string,
    vehicleId: string,
    input: VehicleInput,
  ): Promise<VehicleView> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    const data = await this.catalog.resolveVehicleInput(input);
    try {
      await this.prisma.vehicle.update({ where: { id: vehicle.id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw plateAlreadyUsed();
      }
      throw error;
    }
    return this.vehicleView(ownerId, vehicle.id);
  }

  async setVehicleStatus(
    ownerId: string,
    vehicleId: string,
    status: VehicleStatus,
    ip: string | null,
  ): Promise<VehicleView> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    if (status !== 'ACTIVE') {
      const onRent = await this.prisma.booking.count({
        where: { vehicleId: vehicle.id, status: 'PICKED_UP' },
      });
      if (onRent > 0) {
        throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Le véhicule est en location.');
      }
    }
    if (vehicle.status !== status) {
      await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status } });
      await this.audit.log({
        action: 'vehicle.status_changed',
        actorId: ownerId,
        entityType: 'vehicle',
        entityId: vehicle.id,
        metadata: { from: vehicle.status, to: status },
        ip,
      });
    }
    return this.vehicleView(ownerId, vehicle.id);
  }

  /**
   * Retire le véhicule de la flotte. Refusé tant qu'une demande, une réservation confirmée
   * ou une location en cours existe. Sans aucun historique, la fiche et ses photos sont
   * effacées ; sinon elle est archivée et l'immatriculation est libérée.
   */
  async deleteVehicle(ownerId: string, vehicleId: string, ip: string | null): Promise<void> {
    const agencyId = await this.agencyIdFor(ownerId);
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicleId} FOR UPDATE`;
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, agencyId, deletedAt: null },
        include: { photos: { select: { storageKey: true } } },
      });
      if (vehicle === null) {
        throw new NotFoundException('Véhicule introuvable.');
      }
      const open = await tx.booking.count({
        where: { vehicleId: vehicle.id, status: { in: [...BLOCKING_BOOKING_STATUSES] } },
      });
      if (open > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'Des réservations sont encore ouvertes pour ce véhicule.',
          { reason: 'OPEN_BOOKINGS' },
        );
      }
      const past = await tx.booking.count({ where: { vehicleId: vehicle.id } });
      if (past > 0) {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            deletedAt: new Date(),
            status: 'INACTIVE',
            retiredPlateNumber: vehicle.plateNumber,
            plateNumber: null,
          },
        });
        return { keys: [] as string[], archived: true };
      }
      const keys = vehicle.photos.flatMap((photo) => {
        const pair = vehiclePhotoKeys(photo.storageKey);
        return [pair.large, pair.small];
      });
      await tx.vehicle.delete({ where: { id: vehicle.id } });
      return { keys, archived: false };
    });
    await this.audit.log({
      action: 'vehicle.deleted',
      actorId: ownerId,
      entityType: 'vehicle',
      entityId: vehicleId,
      metadata: { archived: outcome.archived },
      ip,
    });
    if (outcome.keys.length > 0) {
      await this.storage.deletePublic(outcome.keys);
    }
  }

  /**
   * Bloque le véhicule du premier au dernier jour inclus. Refusé si une demande ou une
   * réservation active tombe sur ces jours : le verrou sur le véhicule, pris aussi par les
   * réservations clients, empêche qu'une demande arrive entre la vérification et l'insertion.
   */
  async addMaintenance(
    ownerId: string,
    vehicleId: string,
    input: VehicleMaintenanceRequest,
  ): Promise<VehicleMaintenance> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    const startsAt = tunisDateTime(input.from, 0);
    const endsAt = tunisDateTime(addDays(input.to, 1), 0);
    const maintenance = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicle.id} FOR UPDATE`;
      const conflicts = await tx.booking.findMany({
        where: {
          vehicleId: vehicle.id,
          status: { in: [...BLOCKING_BOOKING_STATUSES] },
          pickupAt: { lt: endsAt },
          returnAt: { gt: startsAt },
        },
        select: { id: true, reference: true },
        orderBy: { pickupAt: 'asc' },
      });
      if (conflicts.length > 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'Des réservations sont prévues sur ces dates : refusez-les ou déplacez l’entretien.',
          { reason: 'BOOKINGS_OVERLAP', bookings: conflicts },
        );
      }
      return tx.vehicleMaintenance.create({
        data: { vehicleId: vehicle.id, startsAt, endsAt, note: input.note },
      });
    });
    return toMaintenance(maintenance);
  }

  async removeMaintenance(
    ownerId: string,
    vehicleId: string,
    maintenanceId: string,
  ): Promise<void> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    const { count } = await this.prisma.vehicleMaintenance.deleteMany({
      where: { id: maintenanceId, vehicleId: vehicle.id },
    });
    if (count === 0) {
      throw new NotFoundException('Entretien introuvable.');
    }
  }

  // --- Avis et paramètres ---------------------------------------------------------

  async replyToReview(
    ownerId: string,
    reviewId: string,
    reply: string,
    ip: string | null,
  ): Promise<Review> {
    const agencyId = await this.agencyIdFor(ownerId);
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, agencyId, ...VISIBLE_REVIEW },
      select: { id: true },
    });
    if (review === null) {
      throw new NotFoundException('Avis introuvable.');
    }
    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: { reply, repliedAt: new Date() },
      include: REVIEW_INCLUDE,
    });
    await this.audit.log({
      action: 'review.replied',
      actorId: ownerId,
      entityType: 'review',
      entityId: review.id,
      metadata: { agencyId },
      ip,
    });
    return toReview(updated);
  }

  /**
   * Signale un avis visible. Il reste affiché tant qu'un administrateur ne le masque pas,
   * pour qu'une agence ne puisse pas faire disparaître une mauvaise note toute seule.
   */
  async reportReview(
    ownerId: string,
    reviewId: string,
    input: ReviewReportInput,
    ip: string | null,
  ): Promise<Review> {
    const agencyId = await this.agencyIdFor(ownerId);
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, agencyId, ...VISIBLE_REVIEW },
      select: { id: true, moderationStatus: true },
    });
    if (review === null) {
      throw new NotFoundException('Avis introuvable.');
    }
    const already = await this.prisma.reviewReport.findFirst({
      where: { reviewId: review.id, reporterId: ownerId },
      select: { id: true },
    });
    if (already !== null) {
      throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Cet avis a déjà été signalé.', [
        { path: 'reason', message: 'ALREADY_REPORTED' },
      ]);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewReport.create({
        data: { reviewId: review.id, reason: input.reason, reporterId: ownerId },
      });
      if (review.moderationStatus === 'PUBLISHED') {
        await tx.review.updateMany({
          where: { id: review.id, moderationStatus: 'PUBLISHED' },
          data: { moderationStatus: 'FLAGGED', moderatedAt: new Date() },
        });
      }
    });
    await this.audit.log({
      action: 'review.reported',
      actorId: ownerId,
      entityType: 'review',
      entityId: review.id,
      metadata: { agencyId, reason: input.reason },
      ip,
    });
    return toReview(
      await this.prisma.review.findUniqueOrThrow({
        where: { id: review.id },
        include: REVIEW_INCLUDE,
      }),
    );
  }

  async updateProfile(ownerId: string, profile: AgencyProfile): Promise<AgencySettings> {
    if ((profile.latitude === null) !== (profile.longitude === null)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'La position est incomplète.',
        [{ path: 'latitude', message: 'OUT_OF_RANGE' }],
      );
    }
    const agencyId = await this.agencyIdFor(ownerId);
    const agency = await this.prisma.agency.update({
      where: { id: agencyId },
      data: { ...profile, email: profile.email ?? null },
    });
    return toSettings(agency, this.publicUrl());
  }

  async updateConditions(ownerId: string, conditions: RentalConditions): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    const agency = await this.prisma.agency.update({ where: { id: agencyId }, data: conditions });
    return toSettings(agency, this.publicUrl());
  }

  /** Remplace le logo de l'agence ; l'ancien fichier n'est supprimé qu'une fois le nouveau enregistré. */
  async setLogo(ownerId: string, image: Buffer): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    const { logoKey: previous } = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: { logoKey: true },
    });
    const logoKey = `agencies/${agencyId}/logo-${randomUUID()}.webp`;
    await this.storage.putPublic(logoKey, image, 'image/webp');

    let agency: Prisma.AgencyGetPayload<object>;
    try {
      agency = await this.prisma.agency.update({ where: { id: agencyId }, data: { logoKey } });
    } catch (error) {
      await this.storage.deletePublic([logoKey]);
      throw error;
    }
    if (previous !== null) {
      await this.storage.deletePublic([previous]);
    }
    return toSettings(agency, this.publicUrl());
  }

  async removeLogo(ownerId: string): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    const { logoKey } = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: { logoKey: true },
    });
    const agency = await this.prisma.agency.update({
      where: { id: agencyId },
      data: { logoKey: null },
    });
    if (logoKey !== null) {
      await this.storage.deletePublic([logoKey]);
    }
    return toSettings(agency, this.publicUrl());
  }
}

import { randomUUID } from 'node:crypto';

import {
  addDays,
  addMonths,
  AGENCY_LIST_LIMIT_DEFAULT,
  type AgencyProfile,
  type AgencySettings,
  applyBookingAction,
  BOOKING_FILTER_STATUSES,
  type BookingFilter,
  type BookingList,
  type BookingQuery,
  type BookingTransitionInput,
  type BookingView,
  canApplyBookingAction,
  type CustomerDetail,
  type CustomerQuery,
  type CustomerView,
  type DashboardData,
  type NavCounts,
  normalizeTunisianPhone,
  type Paginated,
  PAYMENT_METHODS,
  type PaymentList,
  type PaymentMethod,
  type PaymentQuery,
  type PlanningData,
  type RecordPaymentInput,
  type RentalConditions,
  type Review,
  type ReviewList,
  type ReviewQuery,
  todayKey,
  toMonthKey,
  type VehicleInput,
  type VehicleStatus,
  type VehicleView,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { AppException } from '../common/errors/app.exception';
import { pageWindow, toPaginated } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VEHICLE_PHOTOS_INCLUDE } from '../storage/vehicle-photos';
import {
  type BookingRefRow,
  nextBookingRef,
  toBookingView,
  toCustomer,
  toCustomerView,
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

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
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
        where: vehicleId === undefined ? { agencyId } : { agencyId, id: vehicleId },
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
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, agencyId } });
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
    const [vehicles, bookings] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where: { agencyId, status: { not: 'INACTIVE' } },
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
    ]);
    const publicUrl = this.publicUrl();
    return {
      from: window.from,
      to: window.to,
      days: window.days,
      vehicles: vehicles.sort(byVehicleName).map((vehicle) => toVehicle(vehicle, publicUrl)),
      bookings: bookings.map(toPlanningBooking),
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
    const count = await this.prisma.vehicle.count({ where: { agencyId } });
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
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status } });
    return this.vehicleView(ownerId, vehicle.id);
  }

  // --- Avis et paramètres ---------------------------------------------------------

  async replyToReview(ownerId: string, reviewId: string, reply: string): Promise<Review> {
    const agencyId = await this.agencyIdFor(ownerId);
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, agencyId, ...VISIBLE_REVIEW },
      select: { id: true },
    });
    if (review === null) {
      throw new NotFoundException('Avis introuvable.');
    }
    return toReview(
      await this.prisma.review.update({
        where: { id: review.id },
        data: { reply, repliedAt: new Date() },
        include: REVIEW_INCLUDE,
      }),
    );
  }

  async updateProfile(ownerId: string, profile: AgencyProfile): Promise<AgencySettings> {
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

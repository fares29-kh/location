import {
  type AdminDashboard,
  type AdminNavCounts,
  addMonths,
  BOOKING_STATUSES,
  toMonthKey,
} from '@drivetn/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AdminAgenciesService, RENTED_STATUSES } from './admin-agencies.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminReviewsService } from './admin-reviews.service';
import { AGENCY_REF_SELECT, toAgencyRef } from './admin.mapper';
import { monthBounds } from './admin.utils';
import { AuditFeedService } from './audit-feed.service';

const CHART_MONTHS = 6;

/** Tableau de bord et compteurs de la navigation de l'administration. */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencies: AdminAgenciesService,
    private readonly billing: AdminBillingService,
    private readonly reviews: AdminReviewsService,
    private readonly feed: AuditFeedService,
  ) {}

  async navCounts(now: Date = new Date()): Promise<AdminNavCounts> {
    const [pendingAgencies, flaggedReviews, overdueInvoices] = await Promise.all([
      this.prisma.agency.count({ where: { status: 'PENDING_REVIEW' } }),
      this.reviews.flaggedCount(),
      this.billing.overdueCount(now),
    ]);
    return { pendingAgencies, flaggedReviews, overdueInvoices };
  }

  async dashboard(now: Date = new Date()): Promise<AdminDashboard> {
    const month = toMonthKey(now);
    const current = monthBounds(month);
    const previous = monthBounds(addMonths(month, -1));
    // Le mois précédent est comparé sur la même durée écoulée que le mois en cours.
    const previousCut = new Date(
      Math.min(
        previous.end.getTime(),
        previous.start.getTime() + (now.getTime() - current.start.getTime()),
      ),
    );

    const rentedIn = (start: Date, end: Date) =>
      this.prisma.booking.aggregate({
        where: { status: { in: RENTED_STATUSES }, pickupAt: { gte: start, lt: end } },
        _sum: { totalMillimes: true },
        _count: { _all: true },
      });
    const months = Array.from({ length: CHART_MONTHS }, (_, index) =>
      addMonths(month, index - (CHART_MONTHS - 1)),
    );

    const [
      gmvMonth,
      gmvPrevious,
      bookingsMonth,
      bookingsPreviousMonth,
      activeAgencies,
      newAgenciesMonth,
      customers,
      newCustomersMonth,
      chart,
      pendingAgencies,
      top,
      byStatus,
      recentActivity,
      overview,
      overdueInvoices,
    ] = await Promise.all([
      rentedIn(current.start, current.end),
      rentedIn(previous.start, previousCut),
      this.prisma.booking.count({
        where: { createdAt: { gte: current.start, lt: current.end } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: previous.start, lt: previousCut } },
      }),
      this.prisma.agency.count({ where: { status: 'ACTIVE' } }),
      this.prisma.agency.count({ where: { createdAt: { gte: current.start } } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', deletedAt: null, createdAt: { gte: current.start } },
      }),
      Promise.all(
        months.map((key) => {
          const { start, end } = monthBounds(key);
          return rentedIn(start, end);
        }),
      ),
      this.agencies.pending(5, now),
      this.prisma.booking.groupBy({
        by: ['agencyId'],
        where: {
          status: { in: RENTED_STATUSES },
          pickupAt: { gte: current.start, lt: current.end },
        },
        _sum: { totalMillimes: true },
        _count: { _all: true },
        orderBy: { _sum: { totalMillimes: 'desc' } },
        take: 5,
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { pickupAt: { gte: current.start, lt: current.end } },
        _count: { _all: true },
      }),
      this.feed.entries({ NOT: { action: { startsWith: 'auth.' } } }, 7),
      this.billing.overview(now),
      this.billing.overdueCount(now),
    ]);

    const topAgencies = await this.prisma.agency.findMany({
      where: { id: { in: top.map((row) => row.agencyId) } },
      select: AGENCY_REF_SELECT,
    });
    const agencyById = new Map(topAgencies.map((agency) => [agency.id, toAgencyRef(agency)]));

    return {
      kpis: {
        gmvMonthMillimes: gmvMonth._sum.totalMillimes ?? 0,
        gmvPreviousMonthMillimes: gmvPrevious._sum.totalMillimes ?? 0,
        bookingsMonth,
        bookingsPreviousMonth,
        activeAgencies,
        newAgenciesMonth,
        customers,
        newCustomersMonth,
      },
      gmvByMonth: months.map((key, index) => ({
        month: key,
        amountMillimes: chart[index]?._sum.totalMillimes ?? 0,
        bookings: chart[index]?._count._all ?? 0,
      })),
      pendingAgencies,
      topAgencies: top.flatMap((row) => {
        const agency = agencyById.get(row.agencyId);
        return agency === undefined
          ? []
          : [
              {
                agency,
                gmvMillimes: row._sum.totalMillimes ?? 0,
                bookings: row._count._all,
              },
            ];
      }),
      bookingStatus: BOOKING_STATUSES.map((status) => ({
        status,
        count: byStatus.find((group) => group.status === status)?._count._all ?? 0,
      })).filter((entry) => entry.count > 0),
      recentActivity,
      billing: {
        mrrMillimes: overview.mrrMillimes,
        outstandingMillimes: overview.outstandingMillimes,
        overdueInvoices,
      },
    };
  }
}

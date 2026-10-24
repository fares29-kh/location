import {
  type AdminAgency,
  type AdminAgencyDetail,
  ADMIN_AGENCY_FILTER_STATUSES,
  type AdminAgencyList,
  type AdminAgencyQuery,
  type AgencyDecision,
  type AgencyDecisionInput,
  applyAgencyDecision,
  type AuditAction,
  getAgencyDecisions,
  normalizeTunisianPhone,
  toMonthKey,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { BookingStatus, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_AGENCY_INCLUDE,
  type AgencyStats,
  EMPTY_AGENCY_STATS,
  INVOICE_INCLUDE,
  PLATFORM_BOOKING_INCLUDE,
  toAdminAgency,
  toInvoice,
  toPlatformBooking,
} from './admin.mapper';
import { contains, monthBounds, pageWindow, paginated } from './admin.utils';
import { AuditFeedService } from './audit-feed.service';

/** Locations effectivement réalisées, comptées dans le volume d'affaires. */
export const RENTED_STATUSES: BookingStatus[] = ['PICKED_UP', 'RETURNED', 'COMPLETED'];

const DECISION_ACTIONS: Record<AgencyDecision, AuditAction> = {
  APPROVE: 'agency.approved',
  REJECT: 'agency.rejected',
  SUSPEND: 'agency.suspended',
  REACTIVATE: 'agency.reactivated',
};

function decisionConflict(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'CONFLICT',
    'Cette décision n’est plus possible pour cette agence.',
  );
}

@Injectable()
export class AdminAgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly feed: AuditFeedService,
  ) {}

  async list(query: AdminAgencyQuery, now: Date = new Date()): Promise<AdminAgencyList> {
    const searched = this.searchWhere(query.search);
    const where: Prisma.AgencyWhereInput =
      query.filter === 'all'
        ? searched
        : { AND: [searched, { status: ADMIN_AGENCY_FILTER_STATUSES[query.filter] }] };

    const [byStatus, total] = await Promise.all([
      this.prisma.agency.groupBy({ by: ['status'], where: searched, _count: { _all: true } }),
      this.prisma.agency.count({ where }),
    ]);
    const window = pageWindow(query.page, total);
    const rows = await this.prisma.agency.findMany({
      where,
      include: ADMIN_AGENCY_INCLUDE,
      orderBy:
        query.filter === 'pending'
          ? [{ createdAt: 'asc' }]
          : [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip: window.skip,
      take: window.pageSize,
    });
    const stats = await this.stats(
      rows.map((row) => row.id),
      now,
    );

    const countOf = (status: AdminAgency['status']) =>
      byStatus.find((group) => group.status === status)?._count._all ?? 0;
    return {
      ...paginated(
        rows.map((row) => toAdminAgency(row, stats.get(row.id) ?? EMPTY_AGENCY_STATS)),
        total,
        window,
      ),
      counts: {
        all: byStatus.reduce((sum, group) => sum + group._count._all, 0),
        pending: countOf('PENDING_REVIEW'),
        active: countOf('ACTIVE'),
        suspended: countOf('SUSPENDED'),
        rejected: countOf('REJECTED'),
      },
    };
  }

  /** Demandes d'inscription en attente, de la plus ancienne à la plus récente. */
  async pending(take: number, now: Date = new Date()): Promise<AdminAgency[]> {
    const rows = await this.prisma.agency.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: ADMIN_AGENCY_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take,
    });
    const stats = await this.stats(
      rows.map((row) => row.id),
      now,
    );
    return rows.map((row) => toAdminAgency(row, stats.get(row.id) ?? EMPTY_AGENCY_STATS));
  }

  async detail(id: string, now: Date = new Date()): Promise<AdminAgencyDetail> {
    const agency = await this.find(id, now);
    const [bookings, invoices, activity] = await Promise.all([
      this.prisma.booking.findMany({
        where: { agencyId: id },
        include: PLATFORM_BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.invoice.findMany({
        where: { agencyId: id },
        include: INVOICE_INCLUDE,
        orderBy: { issuedAt: 'desc' },
        take: 4,
      }),
      this.feed.entries(
        {
          OR: [
            { entityType: 'agency', entityId: id },
            { metadata: { path: ['agencyId'], equals: id } },
          ],
        },
        8,
      ),
    ]);
    return {
      ...agency,
      recentBookings: bookings.map(toPlatformBooking),
      invoices: invoices.map((invoice) => toInvoice(invoice, now)),
      activity,
    };
  }

  async decide(
    id: string,
    input: AgencyDecisionInput,
    actorId: string,
    ip: string | null,
  ): Promise<AdminAgency> {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      select: { status: true },
    });
    if (agency === null) {
      throw new NotFoundException('Agence introuvable.');
    }
    if (!getAgencyDecisions(agency.status).includes(input.decision)) {
      throw decisionConflict();
    }
    const reason = input.reason !== undefined && input.reason.length > 0 ? input.reason : null;
    const updated = await this.prisma.agency.updateMany({
      where: { id, status: agency.status },
      data: {
        status: applyAgencyDecision(agency.status, input.decision),
        decidedAt: new Date(),
        statusReason: reason,
        billingHoldFrom: null,
      },
    });
    if (updated.count === 0) {
      throw decisionConflict();
    }
    await this.audit.log({
      action: DECISION_ACTIONS[input.decision],
      actorId,
      entityType: 'agency',
      entityId: id,
      metadata: { previousStatus: agency.status, ...(reason === null ? {} : { reason }) },
      ip,
    });
    return this.find(id);
  }

  private async find(id: string, now: Date = new Date()): Promise<AdminAgency> {
    const row = await this.prisma.agency.findUnique({
      where: { id },
      include: ADMIN_AGENCY_INCLUDE,
    });
    if (row === null) {
      throw new NotFoundException('Agence introuvable.');
    }
    const stats = await this.stats([id], now);
    return toAdminAgency(row, stats.get(id) ?? EMPTY_AGENCY_STATS);
  }

  /** Volume d'affaires du mois et note publique (avis masqués exclus) de chaque agence. */
  async stats(agencyIds: string[], now: Date = new Date()): Promise<Map<string, AgencyStats>> {
    if (agencyIds.length === 0) {
      return new Map();
    }
    const { start, end } = monthBounds(toMonthKey(now));
    const [gmv, ratings] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['agencyId'],
        where: {
          agencyId: { in: agencyIds },
          status: { in: RENTED_STATUSES },
          pickupAt: { gte: start, lt: end },
        },
        _sum: { totalMillimes: true },
      }),
      this.prisma.review.groupBy({
        by: ['agencyId'],
        where: { agencyId: { in: agencyIds }, moderationStatus: { not: 'HIDDEN' } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    const gmvByAgency = new Map(gmv.map((row) => [row.agencyId, row._sum.totalMillimes ?? 0]));
    const ratingByAgency = new Map(ratings.map((row) => [row.agencyId, row]));
    return new Map(
      agencyIds.map((id) => {
        const rating = ratingByAgency.get(id);
        return [
          id,
          {
            gmvMonthMillimes: gmvByAgency.get(id) ?? 0,
            rating: { average: rating?._avg.rating ?? 0, count: rating?._count._all ?? 0 },
          },
        ];
      }),
    );
  }

  private searchWhere(search: string): Prisma.AgencyWhereInput {
    if (search.length === 0) {
      return {};
    }
    const text = contains(search);
    const compact = search.replace(/\s+/g, '');
    const digits = contains(compact);
    const national = normalizeTunisianPhone(compact);
    return {
      OR: [
        { name: text },
        { taxId: text },
        { email: text },
        { phone: digits },
        ...(national.length === 8 ? [{ extraPhones: { has: national } }] : []),
        { governorate: { nameFr: text } },
        {
          owner: {
            OR: [{ firstName: text }, { lastName: text }, { email: text }, { phone: digits }],
          },
        },
      ],
    };
  }
}

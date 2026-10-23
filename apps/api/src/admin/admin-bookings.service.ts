import {
  PLATFORM_BOOKING_FILTER_STATUSES,
  PLATFORM_BOOKING_FILTERS,
  type PlatformBookingFilter,
  type PlatformBookingList,
  type PlatformBookingQuery,
} from '@drivetn/types';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PlatformSettingsService } from '../platform/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_BOOKING_INCLUDE, toPlatformBooking } from './admin.mapper';
import { contains, pageWindow, paginated } from './admin.utils';

const HOUR_MS = 3_600_000;

/** Supervision des réservations de toutes les agences. */
@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
  ) {}

  async list(query: PlatformBookingQuery, now: Date = new Date()): Promise<PlatformBookingList> {
    const searched = this.searchWhere(query.search);
    const where: Prisma.BookingWhereInput =
      query.filter === 'all'
        ? searched
        : {
            AND: [
              searched,
              { status: { in: [...PLATFORM_BOOKING_FILTER_STATUSES[query.filter]] } },
            ],
          };
    const { bookingExpiryHours } = await this.settings.get();

    const [byStatus, total, stalePending] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['status'], where: searched, _count: { _all: true } }),
      this.prisma.booking.count({ where }),
      this.prisma.booking.count({
        where: {
          AND: [
            searched,
            {
              status: 'PENDING',
              createdAt: { lt: new Date(now.getTime() - bookingExpiryHours * HOUR_MS) },
            },
          ],
        },
      }),
    ]);
    const window = pageWindow(query.page, total);
    const rows = await this.prisma.booking.findMany({
      where,
      include: PLATFORM_BOOKING_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: window.skip,
      take: window.pageSize,
    });

    const countOf = (filter: PlatformBookingFilter) =>
      byStatus
        .filter(
          (group) =>
            filter === 'all' || PLATFORM_BOOKING_FILTER_STATUSES[filter].includes(group.status),
        )
        .reduce((sum, group) => sum + group._count._all, 0);
    return {
      ...paginated(rows.map(toPlatformBooking), total, window),
      counts: Object.fromEntries(
        PLATFORM_BOOKING_FILTERS.map((filter) => [filter, countOf(filter)]),
      ) as Record<PlatformBookingFilter, number>,
      stalePending,
    };
  }

  private searchWhere(search: string): Prisma.BookingWhereInput {
    if (search.length === 0) {
      return {};
    }
    const text = contains(search);
    return {
      OR: [
        { reference: text },
        { agency: { name: text } },
        { vehicle: { plateNumber: text } },
        { vehicle: { retiredPlateNumber: text } },
        {
          customer: {
            OR: [
              { firstName: text },
              { lastName: text },
              { phone: contains(search.replace(/\s+/g, '')) },
            ],
          },
        },
      ],
    };
  }
}

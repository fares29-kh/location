import { Injectable, Logger } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

const HOUR_MS = 3_600_000;
const BATCH_SIZE = 200;

/** Fait expirer les demandes de réservation restées sans réponse au-delà du délai réglé. */
@Injectable()
export class BookingExpiryService {
  private readonly logger = new Logger(BookingExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: PlatformSettingsService,
  ) {}

  async expireStale(now: Date = new Date()): Promise<number> {
    const { bookingExpiryHours } = await this.settings.get();
    const stale = await this.prisma.booking.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: new Date(now.getTime() - bookingExpiryHours * HOUR_MS) },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let expired = 0;
    for (const { id } of stale) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        if (updated.count === 0) {
          return false;
        }
        await tx.bookingEvent.create({ data: { bookingId: id, status: 'EXPIRED' } });
        return true;
      });
      if (changed) {
        await this.audit.log({
          action: 'booking.status_changed',
          entityType: 'booking',
          entityId: id,
          metadata: { from: 'PENDING', to: 'EXPIRED' },
        });
        expired += 1;
      }
    }
    if (expired > 0) {
      this.logger.log(
        `${String(expired)} demande(s) expirée(s) après ${String(bookingExpiryHours)} h`,
      );
    }
    return expired;
  }
}

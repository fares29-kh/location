import {
  type ModeratedReview,
  type ModeratedReviewList,
  type ModerationFilter,
  type ModerationQuery,
  type ReviewModerationInput,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ReviewModerationStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MODERATED_REVIEW_INCLUDE, toModeratedReview } from './admin.mapper';
import { pageWindow, paginated } from './admin.utils';

const FILTER_STATUS: Record<Exclude<ModerationFilter, 'all'>, ReviewModerationStatus> = {
  flagged: 'FLAGGED',
  published: 'PUBLISHED',
  hidden: 'HIDDEN',
};

function alreadyModerated(): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Cet avis a déjà été modéré.');
}

/** Modération des avis clients : les avis masqués ne sont plus publics ni comptés. */
@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ModerationQuery): Promise<ModeratedReviewList> {
    const where: Prisma.ReviewWhereInput =
      query.filter === 'all' ? {} : { moderationStatus: FILTER_STATUS[query.filter] };
    const [byStatus, total] = await Promise.all([
      this.prisma.review.groupBy({ by: ['moderationStatus'], _count: { _all: true } }),
      this.prisma.review.count({ where }),
    ]);
    const window = pageWindow(query.page, total);
    const rows = await this.prisma.review.findMany({
      where,
      include: MODERATED_REVIEW_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: window.skip,
      take: window.pageSize,
    });
    const countOf = (status: ReviewModerationStatus) =>
      byStatus.find((group) => group.moderationStatus === status)?._count._all ?? 0;
    return {
      ...paginated(rows.map(toModeratedReview), total, window),
      counts: {
        flagged: countOf('FLAGGED'),
        published: countOf('PUBLISHED'),
        hidden: countOf('HIDDEN'),
        all: byStatus.reduce((sum, group) => sum + group._count._all, 0),
      },
    };
  }

  flaggedCount(): Promise<number> {
    return this.prisma.review.count({ where: { moderationStatus: 'FLAGGED' } });
  }

  async moderate(
    id: string,
    input: ReviewModerationInput,
    actorId: string,
    ip: string | null,
  ): Promise<ModeratedReview> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { moderationStatus: true, agencyId: true },
    });
    if (review === null) {
      throw new NotFoundException('Avis introuvable.');
    }
    const hide = input.decision === 'HIDE';
    const target: ReviewModerationStatus = hide ? 'HIDDEN' : 'PUBLISHED';
    if (review.moderationStatus === target) {
      throw alreadyModerated();
    }
    const reason = hide && input.reason !== undefined ? input.reason : null;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.updateMany({
        where: { id, moderationStatus: review.moderationStatus },
        data: { moderationStatus: target, moderatedAt: new Date(), moderationReason: reason },
      });
      if (updated.count === 0) {
        throw alreadyModerated();
      }
      if (!hide) {
        // Publier un avis signalé revient à rejeter les signalements reçus.
        await tx.reviewReport.deleteMany({ where: { reviewId: id } });
      }
    });
    await this.audit.log({
      action: hide ? 'review.hidden' : 'review.published',
      actorId,
      entityType: 'review',
      entityId: id,
      metadata: { agencyId: review.agencyId, ...(reason === null ? {} : { reason }) },
      ip,
    });

    const row = await this.prisma.review.findUniqueOrThrow({
      where: { id },
      include: MODERATED_REVIEW_INCLUDE,
    });
    return toModeratedReview(row);
  }
}

import {
  type PlatformUser,
  type UserDetail,
  type UserFilter,
  USER_FILTERS,
  type UserList,
  type UserQuery,
  type UserStatusInput,
} from '@drivetn/types';
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { TokenService } from '../auth/token.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_USER_INCLUDE, toPlatformUser } from './admin.mapper';
import { contains, pageWindow, paginated } from './admin.utils';
import { AuditFeedService } from './audit-feed.service';

const FILTER_WHERE: Record<UserFilter, Prisma.UserWhereInput> = {
  all: {},
  customers: { role: 'CUSTOMER' },
  agency: { role: { in: ['AGENCY_OWNER', 'AGENCY_STAFF'] } },
  admins: { role: 'ADMIN' },
  suspended: { status: 'SUSPENDED' },
};

function statusConflict(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'CONFLICT',
    'Le statut de ce compte a déjà été modifié.',
  );
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokens: TokenService,
    private readonly feed: AuditFeedService,
  ) {}

  async list(query: UserQuery): Promise<UserList> {
    const searched = this.searchWhere(query.search);
    const counts = await Promise.all(
      USER_FILTERS.map((filter) =>
        this.prisma.user.count({ where: { AND: [searched, FILTER_WHERE[filter]] } }),
      ),
    );
    const countByFilter = Object.fromEntries(
      USER_FILTERS.map((filter, index) => [filter, counts[index] ?? 0]),
    ) as Record<UserFilter, number>;

    const total = countByFilter[query.filter];
    const window = pageWindow(query.page, total);
    const rows = await this.prisma.user.findMany({
      where: { AND: [searched, FILTER_WHERE[query.filter]] },
      include: PLATFORM_USER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: window.skip,
      take: window.pageSize,
    });
    return { ...paginated(rows.map(toPlatformUser), total, window), counts: countByFilter };
  }

  async detail(id: string): Promise<UserDetail> {
    const [user, activity] = await Promise.all([
      this.find(id),
      this.feed.entries({ OR: [{ actorId: id }, { entityType: 'user', entityId: id }] }, 10),
    ]);
    return { ...user, activity };
  }

  async setStatus(
    id: string,
    input: UserStatusInput,
    actorId: string,
    ip: string | null,
  ): Promise<PlatformUser> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (user === null) {
      throw new NotFoundException('Compte introuvable.');
    }
    if (user.role === 'ADMIN' || user.id === actorId) {
      throw new ForbiddenException('Les comptes administrateurs sont gérés séparément.');
    }
    const suspend = input.decision === 'SUSPEND';
    if (suspend === (user.status === 'SUSPENDED')) {
      throw statusConflict();
    }
    const reason = suspend && input.reason !== undefined ? input.reason : null;
    const updated = await this.prisma.user.updateMany({
      where: { id, status: user.status },
      data: {
        status: suspend
          ? 'SUSPENDED'
          : user.phoneVerifiedAt === null
            ? 'PENDING_VERIFICATION'
            : 'ACTIVE',
        statusReason: reason,
      },
    });
    if (updated.count === 0) {
      throw statusConflict();
    }
    if (suspend) {
      // L'access token en cours reste valable jusqu'à son expiration (15 min au plus).
      await this.tokens.revokeAllForUser(id);
    }
    await this.audit.log({
      action: suspend ? 'user.suspended' : 'user.reactivated',
      actorId,
      entityType: 'user',
      entityId: id,
      metadata: reason === null ? {} : { reason },
      ip,
    });
    return this.find(id);
  }

  private async find(id: string): Promise<PlatformUser> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: PLATFORM_USER_INCLUDE,
    });
    if (row === null) {
      throw new NotFoundException('Compte introuvable.');
    }
    return toPlatformUser(row);
  }

  private searchWhere(search: string): Prisma.UserWhereInput {
    if (search.length === 0) {
      return { deletedAt: null };
    }
    const text = contains(search);
    return {
      deletedAt: null,
      OR: [
        { firstName: text },
        { lastName: text },
        { email: text },
        { phone: contains(search.replace(/\s+/g, '')) },
        { agency: { name: text } },
      ],
    };
  }
}

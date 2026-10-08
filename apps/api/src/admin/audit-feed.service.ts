import {
  ADMIN_AUDIT_PAGE_SIZE,
  type AdminAuditEntry,
  AUDIT_ACTIONS,
  type AuditQuery,
  isAuditAction,
  type Paginated,
} from '@drivetn/types';
import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma, User } from '@prisma/client';

import type { AuditEntityType } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { contains, fullName, pageWindow, paginated } from './admin.utils';

/** Nombre maximal d'éléments retenus par type lors d'une recherche dans le journal. */
const SEARCH_MATCH_LIMIT = 50;

type AuditRow = AuditLog & { actor: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Motif ou détail lisible d'une entrée, tiré de ses métadonnées. */
export function auditDetail(metadata: Prisma.JsonValue): string | null {
  if (!isRecord(metadata)) {
    return null;
  }
  const { reason, changes, from, to } = metadata;
  if (typeof reason === 'string' && reason.length > 0) {
    return reason;
  }
  if (typeof changes === 'string' && changes.length > 0) {
    return changes;
  }
  if (typeof from === 'string' && typeof to === 'string') {
    return `${from} → ${to}`;
  }
  return null;
}

/** Journal d'audit présenté à l'administration : acteur, élément concerné et motif. */
@Injectable()
export class AuditFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditQuery): Promise<Paginated<AdminAuditEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      action:
        query.category === 'all'
          ? { in: [...AUDIT_ACTIONS] }
          : { in: AUDIT_ACTIONS.filter((action) => action.startsWith(`${query.category}.`)) },
      ...(query.search.length > 0 ? { OR: await this.searchConditions(query.search) } : {}),
    };
    const total = await this.prisma.auditLog.count({ where });
    const window = pageWindow(query.page, total, ADMIN_AUDIT_PAGE_SIZE);
    const entries = await this.entries(where, window.pageSize, window.skip);
    return paginated(entries, total, window);
  }

  async entries(where: Prisma.AuditLogWhereInput, take: number, skip = 0) {
    const rows = await this.prisma.auditLog.findMany({
      where: { AND: [where, { action: { in: [...AUDIT_ACTIONS] } }] },
      include: { actor: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
    });
    const targets = await this.resolveTargets(rows);
    return rows.flatMap((row): AdminAuditEntry[] =>
      isAuditAction(row.action)
        ? [
            {
              id: row.id,
              action: row.action,
              actor: row.actor,
              target:
                row.entityType === null || row.entityId === null
                  ? null
                  : (targets.get(`${row.entityType}:${row.entityId}`) ?? null),
              detail: auditDetail(row.metadata),
              ip: row.ip,
              createdAt: row.createdAt.toISOString(),
            },
          ]
        : [],
    );
  }

  /** Libellés des éléments concernés, chargés par lot pour chaque type. */
  private async resolveTargets(rows: AuditRow[]): Promise<Map<string, string>> {
    const idsOf = (type: AuditEntityType) => [
      ...new Set(
        rows.flatMap((row) =>
          row.entityType === type && row.entityId !== null ? [row.entityId] : [],
        ),
      ),
    ];
    const [agencies, users, bookings, payments, invoices, reviews] = await Promise.all([
      this.prisma.agency.findMany({
        where: { id: { in: idsOf('agency') } },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: idsOf('user') } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.booking.findMany({
        where: { id: { in: idsOf('booking') } },
        select: { id: true, reference: true },
      }),
      this.prisma.payment.findMany({
        where: { id: { in: idsOf('payment') } },
        select: { id: true, booking: { select: { reference: true } } },
      }),
      this.prisma.invoice.findMany({
        where: { id: { in: idsOf('invoice') } },
        select: { id: true, number: true },
      }),
      this.prisma.review.findMany({
        where: { id: { in: idsOf('review') } },
        select: { id: true, agency: { select: { name: true } } },
      }),
    ]);
    return new Map([
      ...agencies.map((row) => [`agency:${row.id}`, row.name] as const),
      ...users.map((row) => [`user:${row.id}`, fullName(row)] as const),
      ...bookings.map((row) => [`booking:${row.id}`, row.reference] as const),
      ...payments.map((row) => [`payment:${row.id}`, row.booking.reference] as const),
      ...invoices.map((row) => [`invoice:${row.id}`, row.number] as const),
      ...reviews.map((row) => [`review:${row.id}`, row.agency.name] as const),
    ]);
  }

  /** Recherche sur l'adresse IP, l'acteur et le libellé des éléments concernés. */
  private async searchConditions(search: string): Promise<Prisma.AuditLogWhereInput[]> {
    const text = contains(search);
    const ids = (rows: { id: string }[]) => rows.map((row) => row.id);
    const take = SEARCH_MATCH_LIMIT;
    const [agencies, users, bookings, invoices] = await Promise.all([
      this.prisma.agency.findMany({ where: { name: text }, select: { id: true }, take }),
      this.prisma.user.findMany({
        where: { OR: [{ firstName: text }, { lastName: text }, { email: text }] },
        select: { id: true },
        take,
      }),
      this.prisma.booking.findMany({ where: { reference: text }, select: { id: true }, take }),
      this.prisma.invoice.findMany({ where: { number: text }, select: { id: true }, take }),
    ]);
    return [
      { ip: text },
      { actorId: { in: ids(users) } },
      { entityType: 'agency', entityId: { in: ids(agencies) } },
      { entityType: 'user', entityId: { in: ids(users) } },
      { entityType: 'booking', entityId: { in: ids(bookings) } },
      { entityType: 'invoice', entityId: { in: ids(invoices) } },
    ];
  }
}

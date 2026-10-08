import {
  type BillingOverview,
  type Invoice,
  type InvoiceFilter,
  INVOICE_FILTERS,
  type InvoiceList,
  type InvoiceQuery,
  type PaymentMethod,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
  toDayKey,
  toE164,
  toMonthKey,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { INVOICE_INCLUDE, toInvoice } from './admin.mapper';
import { contains, monthBounds, pageWindow, paginated } from './admin.utils';

/** Délai minimal entre deux relances d'une même facture. */
const REMINDER_COOLDOWN_MS = 24 * 3_600_000;

function filterWhere(filter: InvoiceFilter, now: Date): Prisma.InvoiceWhereInput {
  switch (filter) {
    case 'all':
      return {};
    case 'issued':
      return { paidAt: null, dueAt: { gte: now } };
    case 'overdue':
      return { paidAt: null, dueAt: { lt: now } };
    case 'paid':
      return { paidAt: { not: null } };
  }
}

function alreadyPaid(): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Cette facture est déjà réglée.');
}

/** Factures d'abonnement des agences : suivi, encaissement et relances. */
@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly messaging: MessagingService,
  ) {}

  async list(query: InvoiceQuery, now: Date = new Date()): Promise<InvoiceList> {
    const searched: Prisma.InvoiceWhereInput =
      query.search.length === 0
        ? {}
        : {
            OR: [{ number: contains(query.search) }, { agency: { name: contains(query.search) } }],
          };
    const counts = await Promise.all(
      INVOICE_FILTERS.map((filter) =>
        this.prisma.invoice.count({ where: { AND: [searched, filterWhere(filter, now)] } }),
      ),
    );
    const countByFilter = Object.fromEntries(
      INVOICE_FILTERS.map((filter, index) => [filter, counts[index] ?? 0]),
    ) as Record<InvoiceFilter, number>;

    const total = countByFilter[query.filter];
    const window = pageWindow(query.page, total);
    const [rows, overview] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { AND: [searched, filterWhere(query.filter, now)] },
        include: INVOICE_INCLUDE,
        orderBy: [{ issuedAt: 'desc' }, { number: 'desc' }],
        skip: window.skip,
        take: window.pageSize,
      }),
      this.overview(now),
    ]);
    return {
      ...paginated(
        rows.map((row) => toInvoice(row, now)),
        total,
        window,
      ),
      counts: countByFilter,
      overview,
    };
  }

  async overview(now: Date = new Date()): Promise<BillingOverview> {
    const { start, end } = monthBounds(toMonthKey(now));
    const sumOf = async (where: Prisma.InvoiceWhereInput) =>
      (await this.prisma.invoice.aggregate({ where, _sum: { totalMillimes: true } }))._sum
        .totalMillimes ?? 0;
    const [plans, collectedMonthMillimes, outstandingMillimes, overdueMillimes] = await Promise.all(
      [
        this.prisma.agency.groupBy({
          by: ['plan'],
          where: { status: 'ACTIVE' },
          _count: { _all: true },
        }),
        sumOf({ paidAt: { gte: start, lt: end } }),
        sumOf({ paidAt: null }),
        sumOf({ paidAt: null, dueAt: { lt: now } }),
      ],
    );
    const agenciesOn = (plan: (typeof SUBSCRIPTION_PLANS)[number]) =>
      plans.find((group) => group.plan === plan)?._count._all ?? 0;
    return {
      mrrMillimes: SUBSCRIPTION_PLANS.reduce(
        (sum, plan) =>
          sum + agenciesOn(plan) * SUBSCRIPTION_PLAN_DEFINITIONS[plan].monthlyPriceMillimes,
        0,
      ),
      collectedMonthMillimes,
      outstandingMillimes,
      overdueMillimes,
      plans: SUBSCRIPTION_PLANS.map((plan) => ({ plan, agencies: agenciesOn(plan) })),
    };
  }

  overdueCount(now: Date = new Date()): Promise<number> {
    return this.prisma.invoice.count({ where: filterWhere('overdue', now) });
  }

  async get(id: string, now: Date = new Date()): Promise<Invoice> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (row === null) {
      throw new NotFoundException('Facture introuvable.');
    }
    return toInvoice(row, now);
  }

  async markPaid(
    id: string,
    method: PaymentMethod,
    actorId: string,
    ip: string | null,
  ): Promise<Invoice> {
    const updated = await this.prisma.invoice.updateMany({
      where: { id, paidAt: null },
      data: { paidAt: new Date(), paymentMethod: method },
    });
    if (updated.count === 0) {
      await this.get(id);
      throw alreadyPaid();
    }
    const invoice = await this.get(id);
    await this.audit.log({
      action: 'invoice.paid',
      actorId,
      entityType: 'invoice',
      entityId: id,
      metadata: { agencyId: invoice.agency.id, method },
      ip,
    });
    return invoice;
  }

  /** Relance le gérant par WhatsApp (au plus une fois par 24 h et par facture). */
  async sendReminder(id: string, actorId: string, ip: string | null): Promise<Invoice> {
    const now = new Date();
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { agency: { select: { whatsappPhone: true, owner: { select: { locale: true } } } } },
    });
    if (invoice === null) {
      throw new NotFoundException('Facture introuvable.');
    }
    if (invoice.paidAt !== null) {
      throw alreadyPaid();
    }
    const updated = await this.prisma.invoice.updateMany({
      where: {
        id,
        paidAt: null,
        OR: [
          { remindedAt: null },
          { remindedAt: { lt: new Date(now.getTime() - REMINDER_COOLDOWN_MS) } },
        ],
      },
      data: { remindedAt: now },
    });
    if (updated.count === 0) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Une relance a déjà été envoyée pour cette facture dans les dernières 24 h.',
      );
    }
    try {
      await this.messaging.enqueue({
        template: 'invoice_reminder',
        channel: 'WHATSAPP',
        to: toE164(invoice.agency.whatsappPhone),
        locale: invoice.agency.owner.locale,
        invoiceNumber: invoice.number,
        totalMillimes: invoice.totalMillimes,
        dueDate: toDayKey(invoice.dueAt),
        overdue: invoice.dueAt < now,
      });
    } catch (error) {
      await this.prisma.invoice.update({
        where: { id },
        data: { remindedAt: invoice.remindedAt },
      });
      throw error;
    }
    await this.audit.log({
      action: 'invoice.reminder_sent',
      actorId,
      entityType: 'invoice',
      entityId: id,
      metadata: { agencyId: invoice.agencyId },
      ip,
    });
    return this.get(id, now);
  }
}

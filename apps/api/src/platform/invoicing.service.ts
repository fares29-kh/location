import { billingPeriod, computeInvoiceAmounts, toMonthKey } from '@drivetn/types';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

const DAY_MS = 86_400_000;
/** Délai de paiement minimal lorsqu'une facture est émise après l'échéance habituelle. */
const MIN_PAYMENT_DELAY_MS = 7 * DAY_MS;

/** Numéro de facture « FAC-AAAA-0001 », séquentiel par année d'émission. */
export function invoiceNumber(year: string, sequence: number): string {
  return `FAC-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Facturation mensuelle des agences actives : abonnement de l'offre et commission sur les
 * locations terminées du mois. Une agence n'est facturée que pour les mois entiers écoulés
 * depuis sa dernière décision (validation ou réactivation) ; une agence suspendue ne l'est plus.
 */
@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: PlatformSettingsService,
  ) {}

  /** Émet les factures manquantes du mois (idempotent grâce à l'unicité agence + mois). */
  async issueForPeriod(period: string, now: Date = new Date()): Promise<number> {
    const { start, end, dueAt } = billingPeriod(period);
    const agencies = await this.prisma.agency.findMany({
      where: {
        status: 'ACTIVE',
        invoices: { none: { period } },
        OR: [{ decidedAt: { lte: start } }, { decidedAt: null, createdAt: { lte: start } }],
      },
      select: { id: true, plan: true, commissionBps: true },
      orderBy: { createdAt: 'asc' },
    });
    if (agencies.length === 0) {
      return 0;
    }

    const settings = await this.settings.get();
    const revenues = await this.prisma.booking.groupBy({
      by: ['agencyId'],
      where: {
        agencyId: { in: agencies.map((agency) => agency.id) },
        status: 'COMPLETED',
        pickupAt: { gte: start, lt: end },
      },
      _sum: { totalMillimes: true },
    });
    const revenueByAgency = new Map(
      revenues.map((row) => [row.agencyId, row._sum.totalMillimes ?? 0]),
    );

    const year = toMonthKey(now).slice(0, 4);
    let sequence = await this.lastSequence(year);
    let issued = 0;
    for (const agency of agencies) {
      const amounts = computeInvoiceAmounts({
        plan: agency.plan,
        commissionBps: agency.commissionBps ?? settings.defaultCommissionBps,
        revenueMillimes: revenueByAgency.get(agency.id) ?? 0,
        vatRateBps: settings.vatRateBps,
        fiscalStampMillimes: settings.fiscalStampMillimes,
      });
      sequence += 1;
      try {
        const invoice = await this.prisma.invoice.create({
          data: {
            number: invoiceNumber(year, sequence),
            agencyId: agency.id,
            period,
            plan: agency.plan,
            ...amounts,
            issuedAt: now,
            dueAt: new Date(Math.max(dueAt.getTime(), now.getTime() + MIN_PAYMENT_DELAY_MS)),
          },
        });
        await this.audit.log({
          action: 'invoice.issued',
          entityType: 'invoice',
          entityId: invoice.id,
          metadata: { agencyId: agency.id, period },
        });
        issued += 1;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
        // Émission concurrente : l'agence sera reprise au prochain passage si besoin.
        sequence = await this.lastSequence(year);
      }
    }
    if (issued > 0) {
      this.logger.log(`${String(issued)} facture(s) émise(s) pour ${period}`);
    }
    return issued;
  }

  private async lastSequence(year: string): Promise<number> {
    const prefix = `FAC-${year}-`;
    const last = await this.prisma.invoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return last === null ? 0 : Number.parseInt(last.number.slice(prefix.length), 10) || 0;
  }
}

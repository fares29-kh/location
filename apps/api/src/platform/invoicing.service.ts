import {
  type AgencyBillingNotice,
  billingPeriod,
  computeInvoiceAmounts,
  subscriptionLapsed,
  toMonthKey,
  trialDaysLeft,
} from '@drivetn/types';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

const DAY_MS = 86_400_000;
/** Délai de paiement minimal lorsqu'une facture est émise après l'échéance habituelle. */
const MIN_PAYMENT_DELAY_MS = 7 * DAY_MS;
const HOLDABLE_STATUSES = ['ACTIVE', 'PENDING_REVIEW'] as const;

const TRIAL_HOLD_REASON =
  'L’essai gratuit de 14 jours est terminé et l’abonnement n’est pas réglé.';
const OVERDUE_HOLD_REASON =
  'L’abonnement n’est pas réglé. Le compte est désactivé jusqu’au paiement.';

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

  /**
   * Première facture d'abonnement, échue à la fin de l'essai.
   * Sans effet si le compte n'a pas d'essai ou si le mois est déjà facturé.
   */
  async openTrial(agencyId: string, now: Date = new Date()): Promise<void> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { plan: true, commissionBps: true, trialEndsAt: true },
    });
    if (agency === null) {
      return;
    }
    const { trialEndsAt } = agency;
    if (trialEndsAt === null) {
      return;
    }
    const period = toMonthKey(now);
    const existing = await this.prisma.invoice.findUnique({
      where: { agencyId_period: { agencyId, period } },
      select: { id: true },
    });
    if (existing !== null) {
      return;
    }
    const settings = await this.settings.get();
    const amounts = computeInvoiceAmounts({
      plan: agency.plan,
      commissionBps: agency.commissionBps ?? settings.defaultCommissionBps,
      revenueMillimes: 0,
      vatRateBps: settings.vatRateBps,
      fiscalStampMillimes: settings.fiscalStampMillimes,
    });
    const year = period.slice(0, 4);
    const sequence = (await this.lastSequence(year)) + 1;
    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          number: invoiceNumber(year, sequence),
          agencyId,
          period,
          plan: agency.plan,
          ...amounts,
          issuedAt: now,
          dueAt: new Date(Math.max(trialEndsAt.getTime(), now.getTime())),
        },
      });
      await this.audit.log({
        action: 'invoice.issued',
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: { agencyId, period, trial: true },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
  }

  /** Rattrape la facture d'ouverture des comptes d'essai qui n'en ont pas encore. */
  async ensureOpeningInvoices(now: Date = new Date()): Promise<void> {
    const agencies = await this.prisma.agency.findMany({
      where: { trialEndsAt: { not: null }, invoices: { none: {} } },
      select: { id: true },
    });
    for (const agency of agencies) {
      await this.openTrial(agency.id, now);
    }
  }

  /** Désactive les comptes dont l'essai est fini et l'abonnement impayé. */
  async suspendLapsed(now: Date = new Date()): Promise<number> {
    const agencies = await this.prisma.agency.findMany({
      where: {
        trialEndsAt: { not: null, lt: now },
        status: { in: [...HOLDABLE_STATUSES] },
        billingHoldFrom: null,
      },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        invoices: { select: { paidAt: true, dueAt: true } },
      },
    });
    let suspended = 0;
    for (const agency of agencies) {
      if (await this.holdIfLapsed(agency, now)) {
        suspended += 1;
      }
    }
    if (suspended > 0) {
      this.logger.log(`${String(suspended)} compte(s) désactivé(s) faute d'abonnement réglé`);
    }
    return suspended;
  }

  /** État affiché dans l'espace agence. Applique la coupure avant de répondre. */
  async billingNotice(agencyId: string, now: Date = new Date()): Promise<AgencyBillingNotice> {
    await this.openTrial(agencyId, now);
    const agency = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        billingHoldFrom: true,
        invoices: { select: { paidAt: true, dueAt: true } },
      },
    });
    if (
      agency.billingHoldFrom === null &&
      (agency.status === 'ACTIVE' || agency.status === 'PENDING_REVIEW')
    ) {
      await this.holdIfLapsed(agency, now);
    }
    const fresh = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: { trialEndsAt: true, billingHoldFrom: true, status: true },
    });
    const held = fresh.status === 'SUSPENDED' && fresh.billingHoldFrom !== null;
    return {
      trialEndsAt: fresh.trialEndsAt?.toISOString() ?? null,
      daysLeft: fresh.trialEndsAt === null || held ? null : trialDaysLeft(fresh.trialEndsAt, now),
      held,
    };
  }

  /** Rend le statut d'avant la coupure dès que l'abonnement est de nouveau en règle. */
  async releaseHold(agencyId: string, now: Date = new Date()): Promise<void> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        status: true,
        billingHoldFrom: true,
        trialEndsAt: true,
        invoices: { select: { paidAt: true, dueAt: true } },
      },
    });
    const restored = agency?.status === 'SUSPENDED' ? agency.billingHoldFrom : null;
    if (restored === null || agency === null) {
      return;
    }
    if (subscriptionLapsed({ now, trialEndsAt: agency.trialEndsAt, invoices: agency.invoices })) {
      return;
    }
    const updated = await this.prisma.agency.updateMany({
      where: { id: agencyId, status: 'SUSPENDED', billingHoldFrom: restored },
      data: { status: restored, billingHoldFrom: null, statusReason: null },
    });
    if (updated.count === 0) {
      return;
    }
    await this.audit.log({
      action: 'agency.reactivated',
      entityType: 'agency',
      entityId: agencyId,
      metadata: { automatic: true, restoredStatus: restored, at: now.toISOString() },
    });
  }

  private async holdIfLapsed(
    agency: {
      id: string;
      status: 'ACTIVE' | 'PENDING_REVIEW' | 'SUSPENDED' | 'REJECTED';
      trialEndsAt: Date | null;
      invoices: { paidAt: Date | null; dueAt: Date }[];
    },
    now: Date,
  ): Promise<boolean> {
    if (agency.status !== 'ACTIVE' && agency.status !== 'PENDING_REVIEW') {
      return false;
    }
    if (!subscriptionLapsed({ now, trialEndsAt: agency.trialEndsAt, invoices: agency.invoices })) {
      return false;
    }
    const paid = agency.invoices.some((invoice) => invoice.paidAt !== null);
    const updated = await this.prisma.agency.updateMany({
      where: { id: agency.id, status: agency.status, billingHoldFrom: null },
      data: {
        status: 'SUSPENDED',
        billingHoldFrom: agency.status,
        statusReason: paid ? OVERDUE_HOLD_REASON : TRIAL_HOLD_REASON,
      },
    });
    if (updated.count === 0) {
      return false;
    }
    await this.audit.log({
      action: 'agency.suspended',
      entityType: 'agency',
      entityId: agency.id,
      metadata: { previousStatus: agency.status, automatic: true },
    });
    return true;
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

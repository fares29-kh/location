import { describe, expect, it } from 'vitest';

import { hasAdminPermission } from './admin-permissions';
import { invoiceStatus } from './admin-portal';
import {
  agencyDecisionInputSchema,
  applyAgencyDecision,
  applyRateBps,
  billingPeriod,
  bpsToPercentInput,
  computeInvoiceAmounts,
  computeInvoiceTotals,
  getAgencyDecisions,
  parsePercentToBps,
  platformSettingsSchema,
  reviewModerationInputSchema,
  subscriptionLapsed,
  trialDaysLeft,
  trialEnd,
  TRIAL_DAYS,
  userStatusInputSchema,
} from './platform';

describe('taux en points de base', () => {
  it('applique un taux en arrondissant au millime', () => {
    expect(applyRateBps(100_000, 1900)).toBe(19_000);
    expect(applyRateBps(49_000, 1900)).toBe(9310);
    expect(applyRateBps(12_345, 1900)).toBe(2346);
    expect(applyRateBps(80_000, 0)).toBe(0);
  });

  it('lit un pourcentage saisi', () => {
    expect(parsePercentToBps('19')).toBe(1900);
    expect(parsePercentToBps('7,5')).toBe(750);
    expect(parsePercentToBps(' 2.25 % ')).toBe(225);
    expect(parsePercentToBps('0')).toBe(0);
    expect(parsePercentToBps('100')).toBe(10_000);
  });

  it('refuse les pourcentages invalides', () => {
    expect(parsePercentToBps('')).toBeNull();
    expect(parsePercentToBps('-5')).toBeNull();
    expect(parsePercentToBps('1.234')).toBeNull();
    expect(parsePercentToBps('101')).toBeNull();
    expect(parsePercentToBps('abc')).toBeNull();
  });

  it('reconvertit en valeur de saisie', () => {
    expect(bpsToPercentInput(1900)).toBe('19');
    expect(bpsToPercentInput(750)).toBe('7.5');
  });
});

describe('facturation', () => {
  it('calcule HT, TVA, timbre fiscal et TTC', () => {
    expect(
      computeInvoiceTotals({
        subtotalMillimes: 99_000,
        vatRateBps: 1900,
        fiscalStampMillimes: 1000,
      }),
    ).toEqual({
      subtotalMillimes: 99_000,
      vatMillimes: 18_810,
      fiscalStampMillimes: 1000,
      totalMillimes: 118_810,
    });
  });

  it("ajoute la commission sur le chiffre d'affaires à l'abonnement de l'offre", () => {
    expect(
      computeInvoiceAmounts({
        plan: 'PRO',
        commissionBps: 500,
        revenueMillimes: 1_000_000,
        vatRateBps: 1900,
        fiscalStampMillimes: 1000,
      }),
    ).toEqual({
      subscriptionMillimes: 99_000,
      commissionMillimes: 50_000,
      vatRateBps: 1900,
      subtotalMillimes: 149_000,
      vatMillimes: 28_310,
      fiscalStampMillimes: 1000,
      totalMillimes: 178_310,
    });
  });

  it('émet la facture le 1er du mois suivant, payable avant le 15 (heure de Tunis)', () => {
    const { start, end, issuedAt, dueAt } = billingPeriod('2026-12');
    expect(start.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T23:00:00.000Z');
    expect(issuedAt.toISOString()).toBe('2027-01-01T07:00:00.000Z');
    expect(dueAt.toISOString()).toBe('2027-01-15T22:59:00.000Z');
  });

  it("déduit le statut d'une facture de son règlement et de son échéance", () => {
    const now = new Date('2026-10-20T10:00:00Z');
    const dueAt = '2026-10-15T22:59:00Z';
    expect(invoiceStatus({ paidAt: null, dueAt }, now)).toBe('OVERDUE');
    expect(invoiceStatus({ paidAt: '2026-10-02T09:00:00Z', dueAt }, now)).toBe('PAID');
    expect(invoiceStatus({ paidAt: null, dueAt: '2026-11-15T22:59:00Z' }, now)).toBe('ISSUED');
  });
});

describe("droits de l'administration", () => {
  it('réserve chaque action aux rôles concernés', () => {
    expect(hasAdminPermission('SUPER_ADMIN', 'settings.manage')).toBe(true);
    expect(hasAdminPermission('SUPPORT', 'agencies.decide')).toBe(true);
    expect(hasAdminPermission('SUPPORT', 'billing.manage')).toBe(false);
    expect(hasAdminPermission('FINANCE', 'billing.manage')).toBe(true);
    expect(hasAdminPermission('FINANCE', 'users.manage')).toBe(false);
    expect(hasAdminPermission(null, 'agencies.decide')).toBe(false);
  });
});

describe('décisions sur les agences', () => {
  it('propose les décisions possibles selon le statut', () => {
    expect(getAgencyDecisions('PENDING_REVIEW')).toEqual(['APPROVE', 'REJECT']);
    expect(getAgencyDecisions('ACTIVE')).toEqual(['SUSPEND']);
    expect(getAgencyDecisions('SUSPENDED')).toEqual(['REACTIVATE']);
    expect(getAgencyDecisions('REJECTED')).toEqual(['REACTIVATE']);
  });

  it('applique une décision autorisée et refuse les autres', () => {
    expect(applyAgencyDecision('PENDING_REVIEW', 'APPROVE')).toBe('ACTIVE');
    expect(applyAgencyDecision('ACTIVE', 'SUSPEND')).toBe('SUSPENDED');
    expect(() => applyAgencyDecision('ACTIVE', 'APPROVE')).toThrow();
  });

  it('exige un motif pour un refus ou une suspension', () => {
    expect(agencyDecisionInputSchema.safeParse({ decision: 'APPROVE' }).success).toBe(true);
    expect(agencyDecisionInputSchema.safeParse({ decision: 'SUSPEND' }).success).toBe(false);
    expect(agencyDecisionInputSchema.safeParse({ decision: 'REJECT', reason: '   ' }).success).toBe(
      false,
    );
    expect(
      agencyDecisionInputSchema.safeParse({ decision: 'REJECT', reason: 'Pièces illisibles' })
        .success,
    ).toBe(true);
  });

  it('exige un motif pour masquer un avis ou suspendre un compte', () => {
    expect(reviewModerationInputSchema.safeParse({ decision: 'PUBLISH' }).success).toBe(true);
    expect(reviewModerationInputSchema.safeParse({ decision: 'HIDE' }).success).toBe(false);
    expect(userStatusInputSchema.safeParse({ decision: 'REACTIVATE' }).success).toBe(true);
    expect(userStatusInputSchema.safeParse({ decision: 'SUSPEND' }).success).toBe(false);
  });
});

describe('paramètres de la plateforme', () => {
  const valid = {
    vatRateBps: 1900,
    fiscalStampMillimes: 1000,
    defaultCommissionBps: 0,
    bookingExpiryHours: 24,
    supportPhone: '71000000',
    supportEmail: 'support@drivetn.tn',
  };

  it('accepte les valeurs par défaut', () => {
    expect(platformSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it('borne les taux et délais', () => {
    expect(platformSettingsSchema.safeParse({ ...valid, vatRateBps: 3500 }).success).toBe(false);
    expect(platformSettingsSchema.safeParse({ ...valid, bookingExpiryHours: 0 }).success).toBe(
      false,
    );
  });
});

describe('essai gratuit', () => {
  const openedAt = new Date('2026-10-01T08:00:00.000Z');
  const endsAt = trialEnd(openedAt);

  it('dure 14 jours', () => {
    expect(endsAt.getTime() - openedAt.getTime()).toBe(TRIAL_DAYS * 86_400_000);
    expect(trialDaysLeft(endsAt, openedAt)).toBe(14);
    expect(trialDaysLeft(endsAt, new Date(endsAt.getTime() - 1))).toBe(1);
    expect(trialDaysLeft(endsAt, endsAt)).toBeNull();
  });

  it('laisse le compte ouvert pendant l’essai et le coupe ensuite sans paiement', () => {
    const invoice = { paidAt: null, dueAt: endsAt };
    expect(subscriptionLapsed({ now: openedAt, trialEndsAt: endsAt, invoices: [invoice] })).toBe(
      false,
    );
    expect(
      subscriptionLapsed({
        now: new Date(endsAt.getTime() + 1),
        trialEndsAt: endsAt,
        invoices: [invoice],
      }),
    ).toBe(true);
    expect(
      subscriptionLapsed({
        now: new Date(endsAt.getTime() + 1),
        trialEndsAt: endsAt,
        invoices: [{ paidAt: endsAt, dueAt: endsAt }],
      }),
    ).toBe(false);
  });

  it('coupe aussi un abonnement déjà payé quand une facture suivante est échue', () => {
    const now = new Date('2026-12-20T08:00:00.000Z');
    expect(
      subscriptionLapsed({
        now,
        trialEndsAt: endsAt,
        invoices: [
          { paidAt: endsAt, dueAt: endsAt },
          { paidAt: null, dueAt: new Date('2026-12-15T22:59:00.000Z') },
        ],
      }),
    ).toBe(true);
  });

  it('ne concerne pas les comptes ouverts avant la règle', () => {
    expect(
      subscriptionLapsed({
        now: endsAt,
        trialEndsAt: null,
        invoices: [{ paidAt: null, dueAt: openedAt }],
      }),
    ).toBe(false);
  });
});

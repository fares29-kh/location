import { describe, expect, it } from 'vitest';

import {
  agencyDecisionInputSchema,
  applyAgencyDecision,
  applyRateBps,
  bpsToPercentInput,
  computeInvoiceTotals,
  getAgencyDecisions,
  parsePercentToBps,
  platformSettingsSchema,
  reviewModerationInputSchema,
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

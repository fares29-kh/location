import { computeInvoiceTotals, type CurrentUser } from '@drivetn/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockAdminApi } from './mock-api';
import { createAdminDataset } from './mock-data';
import { hasAdminPermission } from './permissions';

const NOW = new Date('2026-10-07T10:00:00Z');

describe('données de démonstration de la plateforme', () => {
  const dataset = createAdminDataset(NOW);

  it('est déterministe', () => {
    expect(createAdminDataset(NOW).agencies).toEqual(dataset.agencies);
  });

  it('couvre tous les statuts d’agence', () => {
    const statuses = new Set(dataset.agencies.map((agency) => agency.status));
    expect(statuses).toEqual(new Set(['PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED']));
  });

  it('calcule des factures cohérentes (TVA 19 %, timbre 1 DT)', () => {
    expect(dataset.invoices.length).toBeGreaterThan(0);
    for (const invoice of dataset.invoices) {
      expect(invoice.subtotalMillimes).toBe(
        invoice.subscriptionMillimes + invoice.commissionMillimes,
      );
      expect(invoice).toMatchObject(
        computeInvoiceTotals({
          subtotalMillimes: invoice.subtotalMillimes,
          vatRateBps: 1900,
          fiscalStampMillimes: 1000,
        }),
      );
      expect(Date.parse(invoice.issuedAt)).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it('trie le journal du plus récent au plus ancien, sans date future', () => {
    const times = dataset.audit.map((entry) => Date.parse(entry.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW.getTime());
  });

  it('contient des avis signalés à modérer', () => {
    expect(dataset.reviews.some((review) => review.status === 'FLAGGED')).toBe(true);
  });
});

describe('droits des rôles d’administration', () => {
  it('réserve chaque action aux rôles concernés', () => {
    expect(hasAdminPermission('SUPER_ADMIN', 'settings.manage')).toBe(true);
    expect(hasAdminPermission('SUPPORT', 'agencies.decide')).toBe(true);
    expect(hasAdminPermission('SUPPORT', 'billing.manage')).toBe(false);
    expect(hasAdminPermission('FINANCE', 'billing.manage')).toBe(true);
    expect(hasAdminPermission('FINANCE', 'reviews.moderate')).toBe(false);
    expect(hasAdminPermission(null, 'users.manage')).toBe(false);
  });
});

describe('API de démonstration', () => {
  const admin = (adminRole: CurrentUser['adminRole']): CurrentUser => ({
    id: 'me',
    role: 'ADMIN',
    adminRole,
    status: 'ACTIVE',
    firstName: 'Test',
    lastName: 'Admin',
    phone: '20000001',
    phoneVerified: true,
    email: null,
    locale: 'fr',
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function settle<T>(promise: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return promise;
  }

  it('valide une agence en attente et trace la décision', async () => {
    const api = createMockAdminApi();
    api.identify(admin('SUPPORT'));
    const list = await settle(api.listAgencies({ search: '', filter: 'pending', page: 1 }));
    const pending = list.items[0];
    expect(pending).toBeDefined();
    const approved = await settle(api.decideAgency(pending?.id ?? '', { decision: 'APPROVE' }));
    expect(approved.status).toBe('ACTIVE');
    const audit = await settle(api.listAudit({ search: '', category: 'agency', page: 1 }));
    expect(audit.items[0]).toMatchObject({ action: 'agency.approved', target: approved.name });
  });

  it('refuse une action hors du périmètre du rôle', async () => {
    const api = createMockAdminApi();
    api.identify(admin('FINANCE'));
    const list = await settle(api.listAgencies({ search: '', filter: 'pending', page: 1 }));
    const rejection = expect(
      api.decideAgency(list.items[0]?.id ?? '', { decision: 'APPROVE' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await vi.runAllTimersAsync();
    await rejection;
  });
});

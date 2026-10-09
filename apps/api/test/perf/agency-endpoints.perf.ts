import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import { type AgencyQueries, addDays, todayKey } from '@drivetn/types';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { AgencyService } from '../../src/agency/agency.service';
import { planningWindow } from '../../src/agency/planning-window';
import {
  type AgencyTestApp,
  type AuthenticatedAgent,
  createAgencyTestApp,
} from '../support/agency-app';
import { loadLegacyQueries } from '../support/agency-fixtures';
import { PERF_AGENCY_ID, seedVolume } from './volume-seed';

/**
 * Mesure des lectures du portail agence sur un gros volume : ancien chemin (chargement complet
 * de l'agence puis calcul en mémoire) contre requêtes ciblées, puis temps HTTP réels.
 *
 *   PERF_DATABASE_URL=postgresql://…/drivetn_perf PERF_REDIS_URL=redis://… pnpm --filter @drivetn/api perf
 *
 * La base doit se nommer `*_test` ou `*_perf` : elle est vidée puis remplie (`PERF_REUSE=1`
 * réutilise le jeu déjà inséré). Volumes : PERF_BOOKINGS, PERF_VEHICLES, PERF_CUSTOMERS,
 * PERF_OTHER_AGENCIES, PERF_OTHER_BOOKINGS ; échantillons : PERF_ITERATIONS, PERF_WARMUP,
 * PERF_BUDGET_SECONDS ; PERF_ONLY (expression régulière) limite les scénarios mesurés ;
 * PERF_OUTPUT écrit les résultats en JSON.
 */
const env = process.env;
const databaseUrl = env.PERF_DATABASE_URL;
const redisUrl = env.PERF_REDIS_URL ?? env.E2E_REDIS_URL;
const number = (name: string, fallback: number) => {
  const value = Number(env[name]);
  return Number.isInteger(value) && value >= 0 && env[name] !== '' && env[name] !== undefined
    ? value
    : fallback;
};
const OPTIONS = {
  bookings: number('PERF_BOOKINGS', 20_000),
  vehicles: number('PERF_VEHICLES', 200),
  customers: number('PERF_CUSTOMERS', 5_000),
  otherAgencies: number('PERF_OTHER_AGENCIES', 10),
  otherBookings: number('PERF_OTHER_BOOKINGS', 2_000),
};
const ITERATIONS = number('PERF_ITERATIONS', 15);
const WARMUP = number('PERF_WARMUP', 3);
const BUDGET_MS = number('PERF_BUDGET_SECONDS', 20) * 1000;
const MIN_SAMPLES = 3;

function assertDisposableDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!/_(test|perf)$/.test(name)) {
    throw new Error(
      `Base « ${name} » refusée : le script la vide (nom attendu : *_test ou *_perf).`,
    );
  }
}

interface Stats {
  p50: number;
  p95: number;
  mean: number;
  max: number;
}

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1)] ?? 0;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    mean: round(sorted.reduce((total, value) => total + value, 0) / sorted.length),
    max: round(sorted.at(-1) ?? 0),
  };
}

function formatTable(rows: readonly Record<string, string | number>[]): string {
  const [first] = rows;
  if (first === undefined) {
    return '';
  }
  const columns = Object.keys(first);
  const cell = (row: Record<string, string | number>, column: string) => String(row[column] ?? '');
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => cell(row, column).length)),
  );
  const line = (values: string[]) =>
    values.map((value, index) => value.padEnd(widths[index] ?? 0)).join(' | ');
  return [
    line(columns),
    widths.map((width) => '-'.repeat(width)).join('-|-'),
    ...rows.map((row) => line(columns.map((column) => cell(row, column)))),
  ].join('\n');
}

/** L'ancien chemin peut prendre plusieurs secondes par appel : l'échantillonnage s'arrête au budget. */
async function measure(run: () => Promise<unknown>): Promise<{ stats: Stats; bytes: number }> {
  let bytes = 0;
  const warmupEnd = performance.now() + BUDGET_MS / 4;
  for (let index = 0; index < WARMUP && performance.now() < warmupEnd; index += 1) {
    bytes = JSON.stringify(await run()).length;
  }
  const samples: number[] = [];
  const end = performance.now() + BUDGET_MS;
  while (samples.length < MIN_SAMPLES || (samples.length < ITERATIONS && performance.now() < end)) {
    const start = performance.now();
    bytes = JSON.stringify(await run()).length;
    samples.push(performance.now() - start);
  }
  return { stats: stats(samples), bytes };
}

describe.skipIf(databaseUrl === undefined || redisUrl === undefined)(
  'Performance du portail agence',
  () => {
    let ctx: AgencyTestApp;
    let service: AgencyService;
    let agent: AuthenticatedAgent;
    let ownerId = '';
    let agencyId = '';
    let customerId = '';
    const now = new Date();

    beforeAll(async () => {
      assertDisposableDatabase(databaseUrl ?? '');
      ctx = await createAgencyTestApp({ databaseUrl, redisUrl });
      service = ctx.app.get(AgencyService);
      const existing = await ctx.prisma.agency.findUnique({
        where: { id: PERF_AGENCY_ID },
        select: { id: true, ownerId: true },
      });
      if (env.PERF_REUSE === '1' && existing !== null) {
        ({ ownerId, id: agencyId } = existing);
      } else {
        const started = performance.now();
        const seeded = await seedVolume(ctx.prisma, { ...OPTIONS, now });
        process.stdout.write(
          `\nJeu de données inséré en ${String(Math.round((performance.now() - started) / 1000))} s : ` +
            `${JSON.stringify(seeded.rows)} + ${String(OPTIONS.otherAgencies)} agences × ` +
            `${String(OPTIONS.otherBookings)} réservations\n`,
        );
        ({ ownerId, agencyId } = seeded);
      }
      const customer = await ctx.prisma.booking.findFirstOrThrow({
        where: { agencyId },
        select: { customerId: true },
        orderBy: { id: 'asc' },
      });
      customerId = customer.customerId;
      agent = ctx.as(ownerId);
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it('mesure avant / après', async () => {
      const from = addDays(todayKey(now), -3);
      const list = { search: '', page: 1, limit: 20 };
      const legacy = async (read: (queries: AgencyQueries) => unknown) => {
        await service.agencyIdFor(ownerId);
        return read(await loadLegacyQueries(ctx.prisma, agencyId, new Date()));
      };
      const scenarios: {
        name: string;
        before: (queries: AgencyQueries) => unknown;
        after: () => Promise<unknown>;
        http: string;
      }[] = [
        {
          name: 'dashboard',
          before: (q) => q.getDashboard(),
          after: () => service.getDashboard(ownerId),
          http: '/dashboard',
        },
        {
          name: 'nav-counts',
          before: (q) => q.getNavCounts(),
          after: () => service.getNavCounts(ownerId),
          http: '/nav-counts',
        },
        {
          name: 'bookings (page 1)',
          before: (q) => q.listBookings({ ...list, filter: 'all', sort: 'pickup_desc' }),
          after: () =>
            service.listBookings(ownerId, { ...list, filter: 'all', sort: 'pickup_desc' }),
          http: '/bookings',
        },
        {
          name: 'bookings (recherche « Trabelsi », page 3)',
          before: (q) =>
            q.listBookings({
              ...list,
              search: 'trabelsi',
              page: 3,
              filter: 'completed',
              sort: 'created_desc',
            }),
          after: () =>
            service.listBookings(ownerId, {
              ...list,
              search: 'Trabelsi',
              page: 3,
              filter: 'completed',
              sort: 'created_desc',
            }),
          http: '/bookings?search=Trabelsi&page=3&filter=completed&sort=created_desc',
        },
        {
          name: 'bookings (plaque « 123TU1023 »)',
          before: (q) =>
            q.listBookings({ ...list, search: '123tu1023', filter: 'all', sort: 'pickup_desc' }),
          after: () =>
            service.listBookings(ownerId, {
              ...list,
              search: '123TU1023',
              filter: 'all',
              sort: 'pickup_desc',
            }),
          http: '/bookings?search=123TU1023',
        },
        ...[14, 31, 62].map((days) => ({
          name: `planning (${String(days)} jours)`,
          before: (q: AgencyQueries) => q.getPlanning(from, days),
          after: () => service.getPlanning(ownerId, planningWindow({ from, days })),
          http: `/planning?from=${from}&days=${String(days)}`,
        })),
        {
          name: 'planning (défaut : veille, 14 jours)',
          before: (q) => q.getPlanning(addDays(todayKey(now), -1), 14),
          after: () => service.getPlanning(ownerId, planningWindow({})),
          http: '/planning',
        },
        {
          name: 'vehicles',
          before: (q) => q.listVehicles(),
          after: () => service.listVehicles(ownerId),
          http: '/vehicles',
        },
        {
          name: 'customers (page 1)',
          before: (q) => q.listCustomers(list),
          after: () => service.listCustomers(ownerId, list),
          http: '/customers',
        },
        {
          name: 'customers (recherche « sfax »)',
          before: (q) => q.listCustomers({ ...list, search: 'sfax' }),
          after: () => service.listCustomers(ownerId, { ...list, search: 'sfax' }),
          http: '/customers?search=sfax',
        },
        {
          name: 'customers/:id',
          before: (q) => q.getCustomer(customerId),
          after: () => service.getCustomer(ownerId, customerId),
          http: `/customers/${customerId}`,
        },
        {
          name: 'payments (page 1)',
          before: (q) => q.listPayments({ kind: 'ALL', method: 'ALL', page: 1, limit: 20 }),
          after: () =>
            service.listPayments(ownerId, { kind: 'ALL', method: 'ALL', page: 1, limit: 20 }),
          http: '/payments',
        },
        {
          name: 'reviews (page 1)',
          before: (q) => q.listReviews({ filter: 'all', page: 1, limit: 20 }),
          after: () => service.listReviews(ownerId, { filter: 'all', page: 1, limit: 20 }),
          http: '/reviews',
        },
        {
          name: 'reviews (sans réponse, page 3)',
          before: (q) => q.listReviews({ filter: 'unanswered', page: 3, limit: 20 }),
          after: () => service.listReviews(ownerId, { filter: 'unanswered', page: 3, limit: 20 }),
          http: '/reviews?filter=unanswered&page=3',
        },
      ];

      const only = env.PERF_ONLY === undefined ? null : new RegExp(env.PERF_ONLY, 'i');
      const results = [];
      for (const scenario of scenarios.filter((item) => only?.test(item.name) ?? true)) {
        const before = await measure(() => legacy(scenario.before));
        const after = await measure(scenario.after);
        const http = await measure(async () => (await agent.get(scenario.http).expect(200)).text);
        results.push({
          endpoint: scenario.name,
          'avant p50 (ms)': before.stats.p50,
          'avant p95 (ms)': before.stats.p95,
          'après p50 (ms)': after.stats.p50,
          'après p95 (ms)': after.stats.p95,
          gain: `×${(before.stats.p50 / Math.max(after.stats.p50, 0.1)).toFixed(1)}`,
          'HTTP p50 (ms)': http.stats.p50,
          'HTTP p95 (ms)': http.stats.p95,
          'réponse (Ko)': Math.round(after.bytes / 1024),
        });
      }
      process.stdout.write(`\n${formatTable(results)}\n\n`);
      if (env.PERF_OUTPUT !== undefined && env.PERF_OUTPUT !== '') {
        writeFileSync(
          env.PERF_OUTPUT,
          JSON.stringify(
            { at: now.toISOString(), options: OPTIONS, iterations: ITERATIONS, results },
            null,
            2,
          ),
        );
      }
    });
  },
);

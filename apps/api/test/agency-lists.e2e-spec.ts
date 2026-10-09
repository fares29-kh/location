import {
  addDays,
  AGENCY_LIST_LIMIT_DEFAULT,
  AGENCY_LIST_LIMIT_MAX,
  type AgencyQueries,
  BOOKING_FILTER_STATUSES,
  BOOKING_FILTERS,
  BOOKING_SORTS,
  type BookingList,
  type BookingSort,
  type BookingView,
  type CustomerDetail,
  type CustomerView,
  type DashboardData,
  type NavCounts,
  type Paginated,
  type PaymentList,
  type PlanningData,
  REVIEW_FILTERS,
  type Review,
  type ReviewList,
  todayKey,
  type VehicleView,
} from '@drivetn/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AgencyTestApp,
  allPages,
  type AuthenticatedAgent,
  body,
  createAgencyTestApp,
  e2eEnabled,
} from './support/agency-app';
import {
  loadLegacyQueries,
  resetDatabase,
  roundFloats,
  type SeededAgency,
  seedAgency,
} from './support/agency-fixtures';

/**
 * Listes du portail agence : pagination en base (limite par défaut, maximum, pages hors
 * bornes), tris, filtres et recherche, puis parité de chaque lecture avec l'ancien calcul en
 * mémoire (`createAgencyQueries`) à plusieurs instants sensibles. Une seconde agence sert de
 * bruit de fond. Ignoré sans `E2E_DATABASE_URL` / `E2E_REDIS_URL`.
 */
const SEEDED_AT = new Date('2026-10-15T10:30:00.000Z');

/** Milieu de mois, veille de minuit à Tunis, 31 (mois précédent plus court), nouveau mois à Tunis. */
const INSTANTS = [
  '2026-10-15T10:30:00.000Z',
  '2026-10-14T23:10:00.000Z',
  '2026-10-31T12:00:00.000Z',
  '2026-10-31T23:30:00.000Z',
].map((iso) => new Date(iso));

const ALL = 1_000_000;

function compareKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ordre attendu d'une page de réservations : clé de tri, puis identifiant croissant. */
function bookingComparator(sort: BookingSort) {
  return (a: BookingView, b: BookingView): number => {
    switch (sort) {
      case 'pickup_asc':
        return compareKey(a.pickupAt, b.pickupAt) || compareKey(a.id, b.id);
      case 'pickup_desc':
        return compareKey(b.pickupAt, a.pickupAt) || compareKey(a.id, b.id);
      case 'created_desc':
        return compareKey(b.createdAt, a.createdAt) || compareKey(a.id, b.id);
    }
  };
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareKey(a.id, b.id));
}

function items<T>(pages: readonly Paginated<T>[]): T[] {
  return pages.flatMap((page) => page.items);
}

describe.skipIf(!e2eEnabled)('Portail agence : listes, pagination et parité (e2e)', () => {
  let ctx: AgencyTestApp;
  let agency: SeededAgency;
  let as: AuthenticatedAgent;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SEEDED_AT);
    ctx = await createAgencyTestApp();
    await resetDatabase(ctx.prisma);
    agency = await seedAgency(ctx.prisma, { tag: 'a', phoneDigit: '2', now: SEEDED_AT });
    await seedAgency(ctx.prisma, {
      tag: 'b',
      phoneDigit: '5',
      now: new Date('2026-10-02T09:00:00.000Z'),
    });
    as = ctx.as(agency.ownerId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await ctx.app.close();
  });

  describe('pagination', () => {
    it(`applique la limite par défaut (${AGENCY_LIST_LIMIT_DEFAULT}) et plafonne à ${AGENCY_LIST_LIMIT_MAX}`, async () => {
      const total = agency.bookingIds.length;
      expect(total).toBeGreaterThan(AGENCY_LIST_LIMIT_MAX);

      const byDefault = body<BookingList>(await as.get('/bookings').expect(200));
      expect(byDefault).toMatchObject({
        page: 1,
        pageSize: AGENCY_LIST_LIMIT_DEFAULT,
        total,
        pageCount: Math.ceil(total / AGENCY_LIST_LIMIT_DEFAULT),
      });
      expect(byDefault.items).toHaveLength(AGENCY_LIST_LIMIT_DEFAULT);

      for (const [limit, expected] of [
        ['1', 1],
        ['100', 100],
        ['101', 100],
        ['500', 100],
        ['0', AGENCY_LIST_LIMIT_DEFAULT],
        ['-5', AGENCY_LIST_LIMIT_DEFAULT],
        ['2.5', AGENCY_LIST_LIMIT_DEFAULT],
        ['abc', AGENCY_LIST_LIMIT_DEFAULT],
      ] as const) {
        const list = body<BookingList>(await as.get(`/bookings?limit=${limit}`).expect(200));
        expect(list.pageSize, `limit=${limit}`).toBe(expected);
        expect(list.items, `limit=${limit}`).toHaveLength(expected);
        expect(list.pageCount).toBe(Math.ceil(total / expected));
      }

      for (const path of ['/customers', '/payments']) {
        const capped = body<Paginated<unknown>>(await as.get(`${path}?limit=1000`).expect(200));
        expect(capped.pageSize).toBe(AGENCY_LIST_LIMIT_MAX);
        expect(capped.items.length).toBeLessThanOrEqual(AGENCY_LIST_LIMIT_MAX);
        const byDefaultList = body<Paginated<unknown>>(await as.get(path).expect(200));
        expect(byDefaultList.pageSize).toBe(AGENCY_LIST_LIMIT_DEFAULT);
      }
    });

    it('ramène une page hors bornes sur la dernière (ou la première) page', async () => {
      for (const path of ['/bookings', '/customers', '/payments']) {
        const firstPage = body<Paginated<{ id: string }>>(
          await as.get(`${path}?limit=7&page=1`).expect(200),
        );
        const beyond = body<Paginated<{ id: string }>>(
          await as.get(`${path}?limit=7&page=9999`).expect(200),
        );
        expect(beyond.page, path).toBe(firstPage.pageCount);
        const lastPage = body<Paginated<{ id: string }>>(
          await as.get(`${path}?limit=7&page=${firstPage.pageCount}`).expect(200),
        );
        expect(beyond.items).toEqual(lastPage.items);
        expect(beyond.items.length).toBe(firstPage.total - (firstPage.pageCount - 1) * 7);

        for (const page of ['0', '-3', 'abc']) {
          const clamped = body<Paginated<{ id: string }>>(
            await as.get(`${path}?limit=7&page=${page}`).expect(200),
          );
          expect(clamped.page, `${path} page=${page}`).toBe(1);
          expect(clamped.items).toEqual(firstPage.items);
        }
      }

      const empty = body<BookingList>(
        await as.get('/bookings?search=introuvable-xyz&page=5').expect(200),
      );
      expect(empty).toMatchObject({ items: [], total: 0, page: 1, pageCount: 1 });
    });

    it('parcourt chaque tri page par page sans doublon ni oubli', async () => {
      for (const sort of BOOKING_SORTS) {
        const pages = await allPages<BookingView, BookingList>(as, `/bookings?sort=${sort}`, 23);
        const listed = items(pages);
        expect(listed.map((booking) => booking.id).sort()).toEqual([...agency.bookingIds].sort());
        expect(listed).toEqual([...listed].sort(bookingComparator(sort)));
      }

      const customers = items(await allPages<CustomerView>(as, '/customers', 7));
      expect(new Set(customers.map((customer) => customer.id)).size).toBe(customers.length);
      expect(customers.map((customer) => customer.id).sort()).toEqual(
        [...agency.customerIds].sort(),
      );
      for (const [index, customer] of customers.entries()) {
        const next = customers[index + 1];
        if (next !== undefined) {
          expect(
            compareKey(next.lastBookingAt ?? '', customer.lastBookingAt ?? '') ||
              compareKey(customer.id, next.id),
          ).toBeLessThan(0);
        }
      }

      const payments = items(await allPages<PaymentList['items'][number]>(as, '/payments', 41));
      expect(payments.map((payment) => payment.id).sort()).toEqual([...agency.paymentIds].sort());
      for (const [index, payment] of payments.entries()) {
        const next = payments[index + 1];
        if (next !== undefined) {
          expect(
            compareKey(next.recordedAt, payment.recordedAt) || compareKey(payment.id, next.id),
          ).toBeLessThan(0);
        }
      }
    });
  });

  describe('filtres et recherche', () => {
    it('filtre les réservations par statut, avec des compteurs cohérents', async () => {
      const all = body<BookingList>(await as.get('/bookings').expect(200));
      const { counts } = all;
      expect(counts.all).toBe(
        counts.pending + counts.confirmed + counts.ongoing + counts.completed + counts.cancelled,
      );
      for (const filter of BOOKING_FILTERS) {
        const pages = await allPages<BookingView, BookingList>(as, `/bookings?filter=${filter}`);
        const listed = items(pages);
        expect(pages[0]?.total, filter).toBe(counts[filter]);
        expect(listed).toHaveLength(counts[filter]);
        expect(pages[0]?.counts).toEqual(counts);
        if (filter !== 'all') {
          expect(
            listed.every((booking) => BOOKING_FILTER_STATUSES[filter].includes(booking.status)),
          ).toBe(true);
        }
      }
    });

    it('recherche par référence, nom complet, immatriculation et téléphone', async () => {
      const all = items(await allPages<BookingView, BookingList>(as, '/bookings'));
      const sample = all.find((booking) => booking.vehicle.plateNumber !== null) ?? all[0];
      if (sample === undefined) {
        throw new Error('jeu de données vide');
      }
      const search = async (term: string) =>
        items(
          await allPages<BookingView, BookingList>(
            as,
            `/bookings?search=${encodeURIComponent(term)}`,
          ),
        );

      expect((await search(sample.reference.toLowerCase())).map((booking) => booking.id)).toEqual([
        sample.id,
      ]);

      const byName = await search(`${sample.customer.firstName} ${sample.customer.lastName}`);
      expect(byName.map((booking) => booking.id)).toContain(sample.id);
      expect(
        byName.every(
          (booking) =>
            booking.customer.firstName === sample.customer.firstName &&
            booking.customer.lastName === sample.customer.lastName,
        ),
      ).toBe(true);

      const plateDigits = (sample.vehicle.plateNumber ?? '').split(' ').at(-1) ?? '';
      const byPlate = await search(`TU ${plateDigits}`);
      expect(byPlate.map((booking) => booking.id)).toContain(sample.id);
      expect(byPlate.every((booking) => booking.vehicle.plateNumber?.includes(plateDigits))).toBe(
        true,
      );

      const phoneDigits = sample.customer.phone.slice(-6);
      const byPhone = await search(phoneDigits);
      expect(byPhone.map((booking) => booking.id)).toContain(sample.id);

      for (const wildcard of ['%', '_', '\\']) {
        expect(await search(wildcard), wildcard).toEqual([]);
      }
    });

    it('recherche les clients et les encaissements filtrés', async () => {
      const customers = items(await allPages<CustomerView>(as, '/customers'));
      const sample = customers[0];
      if (sample === undefined) {
        throw new Error('aucun client');
      }
      const find = async (term: string) =>
        items(await allPages<CustomerView>(as, `/customers?search=${encodeURIComponent(term)}`));
      expect((await find(`${sample.firstName} ${sample.lastName}`)).map((c) => c.id)).toContain(
        sample.id,
      );
      expect((await find(sample.phone.slice(-5))).map((c) => c.id)).toContain(sample.id);
      expect((await find(sample.city.toUpperCase())).every((c) => c.city === sample.city)).toBe(
        true,
      );
      for (const wildcard of ['%', '_']) {
        expect(await find(wildcard), wildcard).toEqual([]);
      }

      for (const [kind, method] of [
        ['RENTAL', 'ALL'],
        ['ALL', 'CASH'],
        ['DEPOSIT_HELD', 'CARD_TPE'],
        ['REFUND', 'ALL'],
      ] as const) {
        const listed = items(
          await allPages<PaymentList['items'][number]>(
            as,
            `/payments?kind=${kind}&method=${method}`,
          ),
        );
        const expected = await ctx.prisma.payment.count({
          where: {
            booking: { agencyId: agency.agencyId },
            ...(kind === 'ALL' ? {} : { kind }),
            ...(method === 'ALL' ? {} : { method }),
          },
        });
        expect(listed, `${kind}/${method}`).toHaveLength(expected);
        expect(
          listed.every(
            (payment) =>
              (kind === 'ALL' || payment.kind === kind) &&
              (method === 'ALL' || payment.method === method),
          ),
        ).toBe(true);
      }
    });
  });

  describe.each(INSTANTS)('parité avec l’ancien calcul en mémoire à %s', (instant) => {
    let legacy: AgencyQueries;

    beforeAll(async () => {
      vi.setSystemTime(instant);
      legacy = await loadLegacyQueries(ctx.prisma, agency.agencyId, instant);
    });

    afterAll(() => {
      vi.setSystemTime(SEEDED_AT);
    });

    it('tableau de bord et compteurs de navigation', async () => {
      const dashboard = body<DashboardData>(await as.get('/dashboard').expect(200));
      expect(roundFloats(dashboard)).toEqual(roundFloats(legacy.getDashboard()));
      expect(body<NavCounts>(await as.get('/nav-counts').expect(200))).toEqual(
        legacy.getNavCounts(),
      );
    });

    it('réservations : chaque filtre et chaque tri, détail', async () => {
      for (const filter of BOOKING_FILTERS) {
        for (const sort of BOOKING_SORTS) {
          const pages = await allPages<BookingView, BookingList>(
            as,
            `/bookings?filter=${filter}&sort=${sort}`,
          );
          const expected = legacy.listBookings({ filter, sort, search: '', page: 1, limit: ALL });
          expect(items(pages), `${filter}/${sort}`).toEqual(expected.items);
          expect(pages[0]?.counts).toEqual(expected.counts);
        }
      }
      for (const id of agency.bookingIds.slice(0, 5)) {
        expect(body<BookingView>(await as.get(`/bookings/${id}`).expect(200))).toEqual(
          legacy.getBooking(id),
        );
      }
    });

    it('planning et flotte', async () => {
      const from = addDays(todayKey(instant), -3);
      const planning = body<PlanningData>(
        await as.get(`/planning?from=${from}&days=21`).expect(200),
      );
      const expected = legacy.getPlanning(from, 21);
      expect(planning).toMatchObject({ from, to: addDays(from, 21), days: 21 });
      expect(byId(planning.vehicles)).toEqual(byId(expected.vehicles));
      expect(byId(planning.bookings)).toEqual(byId(expected.bookings));

      const vehicles = body<VehicleView[]>(await as.get('/vehicles').expect(200));
      expect(roundFloats(vehicles)).toEqual(roundFloats(legacy.listVehicles()));
    });

    it('clients : liste et fiches', async () => {
      const customers = items(await allPages<CustomerView>(as, '/customers'));
      expect(customers).toEqual(legacy.listCustomers({ search: '', page: 1, limit: ALL }).items);
      for (const customer of customers.slice(0, 4)) {
        expect(body<CustomerDetail>(await as.get(`/customers/${customer.id}`).expect(200))).toEqual(
          legacy.getCustomer(customer.id),
        );
      }
    });

    it('encaissements et avis', async () => {
      for (const [kind, method] of [
        ['ALL', 'ALL'],
        ['RENTAL', 'CASH'],
        ['DEPOSIT_RETURNED', 'ALL'],
      ] as const) {
        const pages = await allPages<PaymentList['items'][number], PaymentList>(
          as,
          `/payments?kind=${kind}&method=${method}`,
        );
        const expected = legacy.listPayments({ kind, method, page: 1, limit: ALL });
        expect(items(pages), `${kind}/${method}`).toEqual(expected.items);
        expect(pages[0]?.summary).toEqual(expected.summary);
      }
      for (const filter of REVIEW_FILTERS) {
        const pages = await allPages<Review, ReviewList>(as, `/reviews?filter=${filter}`, 7);
        const {
          items: expectedItems,
          page: _page,
          pageSize: _pageSize,
          pageCount: _pageCount,
          ...expectedStats
        } = legacy.listReviews({ filter, page: 1, limit: ALL });
        expect(items(pages), filter).toEqual(expectedItems);
        for (const { items: _items, page, pageSize, pageCount, ...stats } of pages) {
          expect(roundFloats(stats), filter).toEqual(roundFloats(expectedStats));
          expect(pageSize).toBe(7);
          expect(pageCount).toBe(Math.max(1, Math.ceil(expectedStats.total / 7)));
          expect(page).toBeLessThanOrEqual(pageCount);
        }
      }
    });
  });
});

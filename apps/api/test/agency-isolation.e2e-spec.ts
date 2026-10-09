import {
  addDays,
  type BookingList,
  type BookingView,
  type CustomerDetail,
  type CustomerView,
  type DashboardData,
  type NavCounts,
  type Paginated,
  type PaymentList,
  type PlanningData,
  type Review,
  type ReviewList,
  todayKey,
  tunisDateTime,
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
  createOwner,
  loadLegacyQueries,
  resetDatabase,
  roundFloats,
  type SeededAgency,
  seedAgency,
} from './support/agency-fixtures';

/**
 * Cloisonnement des agences : avec deux agences A et B (et un client commun), chaque endpoint
 * du portail agence ne renvoie à A que ses propres données, et toute ressource de B lui répond
 * 404. Ignoré sans `E2E_DATABASE_URL` / `E2E_REDIS_URL`.
 */
const NOW = new Date('2026-10-15T10:30:00.000Z');
const B_NOW = new Date('2026-09-28T16:00:00.000Z');

describe.skipIf(!e2eEnabled)('Portail agence : cloisonnement (e2e)', () => {
  let ctx: AgencyTestApp;
  let a: SeededAgency;
  let b: SeededAgency;
  let ownerC: string;
  let asA: AuthenticatedAgent;
  let asC: AuthenticatedAgent;
  let sharedCustomerId: string;
  let bOnlyCustomerId: string;
  let bVehicleId: string;
  let bPhotoId: string;
  let aVehicleId: string;
  let aPhotoId: string;

  const isA = (id: string) => id.startsWith('a_');

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    ctx = await createAgencyTestApp();
    await resetDatabase(ctx.prisma);
    a = await seedAgency(ctx.prisma, { tag: 'a', phoneDigit: '2', now: NOW });
    sharedCustomerId = 'a_cus_001';
    b = await seedAgency(ctx.prisma, {
      tag: 'b',
      phoneDigit: '5',
      now: B_NOW,
      sharedCustomers: new Map([['cus_001', sharedCustomerId]]),
    });
    ownerC = await createOwner(ctx.prisma, 'c', '90000000');
    bOnlyCustomerId = b.customerIds.find((id) => id.startsWith('b_')) ?? '';
    [aVehicleId = ''] = a.vehicleIds;
    [bVehicleId = ''] = b.vehicleIds;
    const photo = (vehicleId: string, key: string) =>
      ctx.prisma.vehiclePhoto.create({
        data: { vehicleId, storageKey: key, position: 0, width: 800, height: 600, sizeBytes: 1000 },
        select: { id: true },
      });
    aPhotoId = (await photo(aVehicleId, 'vehicles/a/photo')).id;
    bPhotoId = (await photo(bVehicleId, 'vehicles/b/photo')).id;
    asA = ctx.as(a.ownerId);
    asC = ctx.as(ownerC);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await ctx.app.close();
  });

  describe('les lectures de A ne contiennent que les données de A', () => {
    it('réservations : listes, compteurs et recherche', async () => {
      const pages = await allPages<BookingView, BookingList>(asA, '/bookings');
      const ids = pages.flatMap((page) => page.items.map((item) => item.id));
      expect(ids.every(isA)).toBe(true);
      expect(new Set(ids)).toEqual(new Set(a.bookingIds));
      expect(pages[0]?.counts.all).toBe(a.bookingIds.length);

      const bReference = (
        await ctx.prisma.booking.findFirstOrThrow({ where: { agencyId: b.agencyId } })
      ).reference;
      const search = body<BookingList>(
        await asA.get(`/bookings?search=${encodeURIComponent(bReference)}`).expect(200),
      );
      expect(search.total).toBe(0);
      expect(search.counts.all).toBe(0);
    });

    it('flotte et planning', async () => {
      const vehicles = body<VehicleView[]>(await asA.get('/vehicles').expect(200));
      expect(new Set(vehicles.map((vehicle) => vehicle.id))).toEqual(new Set(a.vehicleIds));
      for (const vehicle of vehicles) {
        expect(
          [vehicle.currentBooking?.id, vehicle.nextBooking?.id]
            .filter(Boolean)
            .every((id) => isA(id ?? '')),
        ).toBe(true);
        expect(vehicle.photos.every((photo) => photo.id !== bPhotoId)).toBe(true);
      }

      const from = addDays(todayKey(NOW), -10);
      const to = addDays(from, 31);
      const bInWindow = await ctx.prisma.booking.count({
        where: {
          agencyId: b.agencyId,
          pickupAt: { lt: tunisDateTime(to, 0) },
          returnAt: { gt: tunisDateTime(from, 0) },
        },
      });
      expect(bInWindow).toBeGreaterThan(0);
      for (const path of [
        `/planning?from=${from}&days=31`,
        `/planning?from=${from}&to=${to}`,
        '/planning',
      ]) {
        const planning = body<PlanningData>(await asA.get(path).expect(200));
        expect(planning.vehicles.length, path).toBeGreaterThan(0);
        expect(planning.vehicles.every((vehicle) => isA(vehicle.id))).toBe(true);
        expect(planning.bookings.length, path).toBeGreaterThan(0);
        expect(
          planning.bookings.every(
            (booking) => isA(booking.id) && isA(booking.vehicleId) && isA(booking.customer.id),
          ),
          path,
        ).toBe(true);
      }
    });

    it('clients : seules les réservations chez A comptent pour le client commun', async () => {
      const pages = await allPages<CustomerView>(asA, '/customers');
      const customers = pages.flatMap((page) => page.items);
      expect(customers.every((customer) => isA(customer.id))).toBe(true);
      expect(new Set(customers.map((customer) => customer.id))).toEqual(new Set(a.customerIds));

      const aBookingsOfShared = await ctx.prisma.booking.count({
        where: { agencyId: a.agencyId, customerId: sharedCustomerId },
      });
      const bBookingsOfShared = await ctx.prisma.booking.count({
        where: { agencyId: b.agencyId, customerId: sharedCustomerId },
      });
      expect(bBookingsOfShared).toBeGreaterThan(0);
      const shared = customers.find((customer) => customer.id === sharedCustomerId);
      expect(shared?.bookingsCount).toBe(aBookingsOfShared);

      const detail = body<CustomerDetail>(
        await asA.get(`/customers/${sharedCustomerId}`).expect(200),
      );
      expect(detail.bookingsCount).toBe(aBookingsOfShared);
      expect(detail.bookings.every((booking) => isA(booking.id))).toBe(true);
      expect(detail).not.toHaveProperty('passwordHash');
    });

    it('encaissements : journal et synthèse', async () => {
      const pages = await allPages<PaymentList['items'][number]>(asA, '/payments');
      const ids = pages.flatMap((page) => page.items.map((item) => item.id));
      expect(ids.every(isA)).toBe(true);
      expect(new Set(ids)).toEqual(new Set(a.paymentIds));
    });

    it('avis paginés : pages 1, 2 et 3 sans ceux de B ni l’avis masqué', async () => {
      const visible = a.reviewIds.filter((id) => id !== a.hiddenReviewId);
      const limit = 5;
      expect(visible.length).toBeGreaterThan(3 * limit);
      const seen: string[] = [];
      for (const page of [1, 2, 3]) {
        const reviews = body<ReviewList>(
          await asA.get(`/reviews?limit=${limit}&page=${page}`).expect(200),
        );
        expect(reviews).toMatchObject({
          page,
          pageSize: limit,
          total: visible.length,
          count: visible.length,
          pageCount: Math.ceil(visible.length / limit),
        });
        expect(reviews.items).toHaveLength(limit);
        seen.push(...reviews.items.map((review) => review.id));
      }
      expect(seen.every((id) => visible.includes(id))).toBe(true);
      expect(new Set(seen).size).toBe(3 * limit);

      const pages = await allPages<Review, ReviewList>(asA, '/reviews', limit);
      expect(new Set(pages.flatMap((page) => page.items.map((review) => review.id)))).toEqual(
        new Set(visible),
      );
    });

    it('tableau de bord, compteurs et synthèses identiques à un calcul sur les seules données de A', async () => {
      const legacy = await loadLegacyQueries(ctx.prisma, a.agencyId, NOW);

      const dashboard = body<DashboardData>(await asA.get('/dashboard').expect(200));
      expect(roundFloats(dashboard)).toEqual(roundFloats(legacy.getDashboard()));
      expect(
        [...dashboard.pending, ...dashboard.departuresToday, ...dashboard.returnsToday].every(
          (booking) => isA(booking.id),
        ),
      ).toBe(true);

      const nav = body<NavCounts>(await asA.get('/nav-counts').expect(200));
      expect(nav).toEqual(legacy.getNavCounts());

      const payments = body<PaymentList>(await asA.get('/payments').expect(200));
      expect(payments.summary).toEqual(
        legacy.listPayments({ kind: 'ALL', method: 'ALL', page: 1 }).summary,
      );
    });
  });

  describe('les ressources de B répondent 404 à A', () => {
    it('réservation : détail, transition et encaissement', async () => {
      const pending = await ctx.prisma.booking.findFirstOrThrow({
        where: { agencyId: b.agencyId, status: 'PENDING' },
      });
      await asA.get(`/bookings/${a.bookingIds[0] ?? ''}`).expect(200);
      await asA.get(`/bookings/${pending.id}`).expect(404);
      await asA.post(`/bookings/${pending.id}/transition`).send({ action: 'CONFIRM' }).expect(404);
      const paymentsBefore = await ctx.prisma.payment.count({ where: { bookingId: pending.id } });
      await asA
        .post(`/bookings/${pending.id}/payments`)
        .send({ kind: 'RENTAL', method: 'CASH', amountMillimes: 10_000 })
        .expect(404);

      const after = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: pending.id } });
      expect(after.status).toBe('PENDING');
      expect(await ctx.prisma.payment.count({ where: { bookingId: pending.id } })).toBe(
        paymentsBefore,
      );
    });

    it('véhicule : modification, statut et photos', async () => {
      const before = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: bVehicleId } });
      const input = {
        brand: 'Kia',
        model: 'Détourné',
        year: 2024,
        plateNumber: '999 TU 9999',
        category: 'city',
        transmission: 'MANUAL',
        fuel: 'PETROL',
        seats: 4,
        airConditioning: true,
        dailyRateMillimes: 1000,
        depositMillimes: 0,
        mileageLimitKm: null,
      };
      await asA.put(`/vehicles/${bVehicleId}`).send(input).expect(404);
      await asA.patch(`/vehicles/${bVehicleId}/status`).send({ status: 'INACTIVE' }).expect(404);
      await asA
        .post(`/vehicles/${bVehicleId}/photos`)
        .attach('file', Buffer.from('not-an-image'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(404);
      await asA
        .put(`/vehicles/${bVehicleId}/photos/order`)
        .send({ photoIds: [bPhotoId] })
        .expect(404);
      await asA.delete(`/vehicles/${bVehicleId}/photos/${bPhotoId}`).expect(404);
      await asA.delete(`/vehicles/${aVehicleId}/photos/${bPhotoId}`).expect(404);

      expect(await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: bVehicleId } })).toEqual(
        before,
      );
      expect(await ctx.prisma.vehiclePhoto.count({ where: { id: bPhotoId } })).toBe(1);
      await asA
        .put(`/vehicles/${aVehicleId}/photos/order`)
        .send({ photoIds: [aPhotoId] })
        .expect(200);
    });

    it('client propre à B', async () => {
      await asA.get(`/customers/${bOnlyCustomerId}`).expect(404);
    });

    it('avis de B et avis masqué', async () => {
      const bReview = b.reviewIds.find((id) => id !== b.hiddenReviewId) ?? '';
      const before = await ctx.prisma.review.findUniqueOrThrow({ where: { id: bReview } });
      await asA.post(`/reviews/${bReview}/reply`).send({ reply: 'Intrusion' }).expect(404);
      await asA
        .post(`/reviews/${a.hiddenReviewId ?? ''}/reply`)
        .send({ reply: 'Masqué' })
        .expect(404);
      expect(await ctx.prisma.review.findUniqueOrThrow({ where: { id: bReview } })).toEqual(before);
    });
  });

  it('un gérant sans données ne voit rien des autres agences', async () => {
    const dashboard = body<DashboardData>(await asC.get('/dashboard').expect(200));
    expect(dashboard.kpis).toEqual({
      revenueMonthMillimes: 0,
      revenuePreviousMonthMillimes: 0,
      bookingsMonth: 0,
      bookingsPreviousMonth: 0,
      occupancyRate: 0,
      outstandingMillimes: 0,
    });
    expect(dashboard.pending).toEqual([]);
    expect(dashboard.revenueByMonth.every((month) => month.amountMillimes === 0)).toBe(true);
    expect(dashboard.fleet).toEqual({ available: 0, onRent: 0, maintenance: 0, inactive: 0 });
    expect(dashboard.rating).toEqual({ average: 0, count: 0 });

    expect(body<NavCounts>(await asC.get('/nav-counts').expect(200))).toEqual({
      pendingBookings: 0,
      unansweredReviews: 0,
      latestPending: [],
    });
    expect(body<BookingList>(await asC.get('/bookings').expect(200)).total).toBe(0);
    expect(body<VehicleView[]>(await asC.get('/vehicles').expect(200))).toEqual([]);
    const planning = body<PlanningData>(
      await asC.get(`/planning?from=${todayKey(NOW)}&days=7`).expect(200),
    );
    expect(planning.vehicles).toEqual([]);
    expect(planning.bookings).toEqual([]);
    expect(body<Paginated<CustomerView>>(await asC.get('/customers').expect(200)).total).toBe(0);
    const payments = body<PaymentList>(await asC.get('/payments').expect(200));
    expect(payments.total).toBe(0);
    expect(payments.summary.depositsHeldMillimes).toBe(0);
    expect(payments.summary.collectedMonthMillimes).toBe(0);
    expect(body<ReviewList>(await asC.get('/reviews').expect(200))).toMatchObject({
      items: [],
      total: 0,
      count: 0,
      page: 1,
      pageCount: 1,
    });
    expect(body<PlanningData>(await asC.get('/planning').expect(200)).bookings).toEqual([]);
    await asC.get(`/bookings/${a.bookingIds[0] ?? ''}`).expect(404);
    await asC.get(`/customers/${sharedCustomerId}`).expect(404);
  });
});

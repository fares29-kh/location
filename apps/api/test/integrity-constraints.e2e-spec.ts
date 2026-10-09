import {
  BLOCKING_BOOKING_STATUSES,
  type BookingStatus,
  type CustomerBooking,
  type DayKey,
  rentalWindow,
} from '@drivetn/types';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONSTRAINT_MESSAGES,
  findConstraintViolation,
} from '../src/common/errors/constraint-violation';
import { normalizeException } from '../src/common/filters/http-exception.filter';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import {
  type AgencyTestApp,
  type AuthenticatedAgent,
  body,
  createAgencyTestApp,
  e2eEnabled,
} from './support/agency-app';
import { GOVERNORATE_CODE, resetDatabase, seedSmallAgency } from './support/agency-fixtures';

/**
 * Contraintes de la base (migrations 20261008060000 et 20261008060100) : exclusion des
 * réservations actives qui se chevauchent sur un véhicule, bornes des notes, dates et montants.
 * Les écritures directes contournent l'application : seule la base les refuse. Chaque refus
 * doit devenir un 409 en français, jamais un 500. Ignoré sans `E2E_DATABASE_URL` / `E2E_REDIS_URL`.
 */

const NOW = new Date('2026-11-10T10:00:00.000Z');
const LOCATION = 'tunis-centre-test';
const OVERLAP = 'Ce véhicule n’est plus disponible sur ces dates.';
const PLACE = { fr: 'Tunis', ar: 'تونس', en: 'Tunis' };

const VEHICLES = ['http_race', 'db_race', 'partial', 'adjacent', 'cancel', 'checks'] as const;
type VehicleKey = (typeof VEHICLES)[number];
const vehicleId = (key: VehicleKey) => `a_${key}`;

/** Réservation insérée directement, sans passer par l'API. */
function bookingRow(
  id: string,
  vehicle: VehicleKey,
  pickup: DayKey,
  dropoff: DayKey,
  status: BookingStatus = 'CONFIRMED',
) {
  const { pickupAt, returnAt } = rentalWindow(pickup, dropoff);
  return {
    id,
    reference: `DB-${id}`,
    agencyId: 'a_agency',
    vehicleId: vehicleId(vehicle),
    customerId: 'a_c1',
    pickupAt,
    returnAt,
    pickupPlace: PLACE,
    returnPlace: PLACE,
    status,
    dailyRateMillimes: 100_000,
    totalMillimes: 300_000,
    depositMillimes: 500_000,
  };
}

/** Attend que `count` appelants soient arrivés avant de les laisser repartir ensemble. */
function barrier(count: number): () => Promise<void> {
  let arrived = 0;
  let release: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === count) {
      release();
    }
    await ready;
  };
}

/** Écriture qui doit être refusée par la base : contrainte atteinte et réponse HTTP associée. */
async function refusal(write: Promise<unknown>) {
  const error = await write.then(
    () => {
      throw new Error('écriture acceptée alors qu’elle viole une contrainte');
    },
    (reason: unknown) => reason,
  );
  return { violation: findConstraintViolation(error), response: normalizeException(error) };
}

async function expectRefused(write: Promise<unknown>, constraint: string): Promise<void> {
  const { violation, response } = await refusal(write);
  expect(violation?.constraint).toBe(constraint);
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    code: CONSTRAINT_MESSAGES[constraint]?.code,
    message: CONSTRAINT_MESSAGES[constraint]?.message,
    details: { constraint },
  });
}

describe.skipIf(!e2eEnabled)('Contraintes d’intégrité de la base (e2e)', () => {
  let ctx: AgencyTestApp;
  let redis: Redis;
  let customer1: AuthenticatedAgent;
  let customer2: AuthenticatedAgent;

  const request = (
    agent: AuthenticatedAgent,
    vehicle: VehicleKey,
    pickup: DayKey,
    dropoff: DayKey,
  ) =>
    agent
      .post('/bookings')
      .send({ vehicleId: vehicleId(vehicle), pickup, return: dropoff, location: LOCATION });

  const activeOn = (vehicle: VehicleKey) =>
    ctx.prisma.booking.findMany({
      where: { vehicleId: vehicleId(vehicle), status: { in: [...BLOCKING_BOOKING_STATUSES] } },
      orderBy: { pickupAt: 'asc' },
    });

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    ctx = await createAgencyTestApp();
    redis = ctx.app.get<Redis>(REDIS_CLIENT);
    await resetDatabase(ctx.prisma);
    await ctx.prisma.location.upsert({
      where: { slug: LOCATION },
      update: { isActive: true },
      create: {
        slug: LOCATION,
        type: 'CITY',
        governorateCode: GOVERNORATE_CODE,
        nameFr: 'Tunis centre',
        nameAr: 'تونس',
        nameEn: 'Tunis centre',
        latitude: 36.8,
        longitude: 10.18,
      },
    });
    await seedSmallAgency(ctx.prisma, {
      tag: 'a',
      ownerPhone: '20000000',
      vehicles: VEHICLES.map((key, index) => ({
        id: vehicleId(key),
        brand: 'Renault',
        model: 'Clio',
        plateNumber: `${String(100 + index)} TU 1000`,
      })),
      customers: [
        {
          id: 'a_c1',
          firstName: 'Hédi',
          lastName: 'Ben Ali',
          phone: '20111111',
          email: null,
          city: 'Tunis',
        },
        {
          id: 'a_c2',
          firstName: 'Sarra',
          lastName: 'Gharbi',
          phone: '20222222',
          email: null,
          city: 'Sfax',
        },
      ],
      bookings: [
        {
          id: 'a_done',
          vehicleId: vehicleId('checks'),
          customerId: 'a_c1',
          pickupAt: new Date('2026-10-01T09:00:00Z'),
          returnAt: new Date('2026-10-04T09:00:00Z'),
          status: 'COMPLETED',
        },
      ],
    });
    customer1 = ctx.asCustomer('a_c1');
    customer2 = ctx.asCustomer('a_c2');
  });

  beforeEach(async () => {
    // Limite de 10 demandes par heure et par IP : chaque test repart d'un compteur vide.
    const keys = await redis.keys('drivetn:rl:create-booking:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    vi.useRealTimers();
    await ctx.app.close();
  });

  describe('chevauchement des réservations actives', () => {
    it('deux insertions simultanées qui contournent l’application : la base refuse la seconde', async () => {
      const { pickupAt, returnAt } = rentalWindow('2026-12-01', '2026-12-05');
      const checked = barrier(2);
      // Contrôle applicatif naïf (sans verrou) : chacun vérifie, ne voit rien, puis insère.
      const attempt = (id: string) =>
        ctx.prisma.$transaction(async (tx) => {
          const overlapping = await tx.booking.count({
            where: {
              vehicleId: vehicleId('db_race'),
              status: { in: [...BLOCKING_BOOKING_STATUSES] },
              pickupAt: { lt: returnAt },
              returnAt: { gt: pickupAt },
            },
          });
          await checked();
          expect(overlapping).toBe(0);
          return tx.booking.create({
            data: bookingRow(id, 'db_race', '2026-12-01', '2026-12-05'),
          });
        });

      const results = await Promise.allSettled([attempt('race_1'), attempt('race_2')]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason: unknown = rejected[0]?.reason;
      expect(findConstraintViolation(reason)).toEqual({
        sqlState: '23P01',
        constraint: 'bookings_vehicle_no_overlap',
      });
      expect(normalizeException(reason)).toEqual({
        status: 409,
        body: {
          code: 'VEHICLE_UNAVAILABLE',
          message: OVERLAP,
          details: { constraint: 'bookings_vehicle_no_overlap' },
        },
      });
      expect(await activeOn('db_race')).toHaveLength(1);
    });

    it('deux demandes de réservation simultanées : une seule réussit', async () => {
      const responses = await Promise.all([
        request(customer1, 'http_race', '2026-12-01', '2026-12-05'),
        request(customer2, 'http_race', '2026-12-01', '2026-12-05'),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      const refused = responses.find((response) => response.status === 409);
      expect(refused?.body).toEqual({ code: 'VEHICLE_UNAVAILABLE', message: OVERLAP });
      expect(await activeOn('http_race')).toHaveLength(1);
    });

    it('chevauchement partiel refusé, par l’API comme par la base', async () => {
      await request(customer1, 'partial', '2026-12-10', '2026-12-15').expect(201);

      // Commence pendant la location et finit après.
      const late = await request(customer2, 'partial', '2026-12-12', '2026-12-17').expect(409);
      expect(late.body).toMatchObject({ code: 'VEHICLE_UNAVAILABLE', message: OVERLAP });
      // Écritures directes : commence avant et finit pendant, ou commence pendant.
      await expectRefused(
        ctx.prisma.booking.create({
          data: bookingRow('p_before', 'partial', '2026-12-08', '2026-12-11'),
        }),
        'bookings_vehicle_no_overlap',
      );
      await expectRefused(
        ctx.prisma.booking.create({
          data: bookingRow('p_inside', 'partial', '2026-12-14', '2026-12-20'),
        }),
        'bookings_vehicle_no_overlap',
      );
      // Une demande en attente bloque aussi le véhicule.
      await expectRefused(
        ctx.prisma.booking.create({
          data: bookingRow('p_pending', 'partial', '2026-12-11', '2026-12-12', 'PENDING'),
        }),
        'bookings_vehicle_no_overlap',
      );
      expect(await activeOn('partial')).toHaveLength(1);
    });

    it('retour et départ au même instant : acceptés', async () => {
      const first = body<CustomerBooking>(
        await request(customer1, 'adjacent', '2026-12-10', '2026-12-15').expect(201),
      );
      const next = body<CustomerBooking>(
        await request(customer2, 'adjacent', '2026-12-15', '2026-12-18').expect(201),
      );
      expect(next.pickupAt).toBe(first.returnAt);
      // Directement en base, juste avant la première et juste après la seconde.
      await ctx.prisma.booking.create({
        data: bookingRow('adj_before', 'adjacent', '2026-12-07', '2026-12-10'),
      });
      await ctx.prisma.booking.create({
        data: bookingRow('adj_after', 'adjacent', '2026-12-18', '2026-12-20', 'PICKED_UP'),
      });
      expect(await activeOn('adjacent')).toHaveLength(4);
    });

    it('une réservation annulée libère le véhicule', async () => {
      const first = body<CustomerBooking>(
        await request(customer1, 'cancel', '2026-12-10', '2026-12-15').expect(201),
      );
      await request(customer2, 'cancel', '2026-12-12', '2026-12-14').expect(409);

      await customer1.post(`/bookings/${first.id}/cancel`).send({}).expect(201);
      await request(customer2, 'cancel', '2026-12-12', '2026-12-14').expect(201);

      // Statuts terminés ou refusés : n'occupent pas non plus le créneau.
      for (const status of ['REJECTED', 'EXPIRED', 'NO_SHOW', 'RETURNED', 'COMPLETED'] as const) {
        await ctx.prisma.booking.create({
          data: bookingRow(`cancel_${status}`, 'cancel', '2026-12-11', '2026-12-16', status),
        });
      }
      expect((await activeOn('cancel')).map((booking) => booking.customerId)).toEqual(['a_c2']);
    });
  });

  describe('bornes', () => {
    it('note 0 et 6 refusées, 1 à 5 acceptées', async () => {
      const review = (rating: number) =>
        ctx.prisma.review.create({
          data: {
            id: `review_${String(rating)}`,
            bookingId: 'a_done',
            agencyId: 'a_agency',
            customerId: 'a_c1',
            rating,
            comment: 'Très bien.',
          },
        });
      await expectRefused(review(0), 'reviews_rating_check');
      await expectRefused(review(6), 'reviews_rating_check');
      await review(5);
      await ctx.prisma.review.update({ where: { id: 'review_5' }, data: { rating: 1 } });
      await expectRefused(
        ctx.prisma.review.update({ where: { id: 'review_5' }, data: { rating: 6 } }),
        'reviews_rating_check',
      );
      expect(
        (await ctx.prisma.review.findUniqueOrThrow({ where: { id: 'review_5' } })).rating,
      ).toBe(1);
    });

    it('retour avant ou au départ refusé (409, pas 500), et par l’API (400)', async () => {
      const { pickupAt } = rentalWindow('2026-12-20', '2026-12-22');
      await expectRefused(
        ctx.prisma.booking.create({
          data: {
            ...bookingRow('reversed', 'checks', '2026-12-20', '2026-12-22'),
            returnAt: new Date(pickupAt.getTime() - 3_600_000),
          },
        }),
        'bookings_return_after_pickup_check',
      );
      await expectRefused(
        ctx.prisma.booking.create({
          data: {
            ...bookingRow('empty', 'checks', '2026-12-20', '2026-12-22'),
            returnAt: pickupAt,
          },
        }),
        'bookings_return_after_pickup_check',
      );
      const api = await request(customer1, 'checks', '2026-12-22', '2026-12-20').expect(400);
      expect(api.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ path: 'return', message: 'RETURN_BEFORE_PICKUP' }],
      });
    });

    it('montants négatifs refusés ; total et caution à 0 acceptés', async () => {
      const update = (data: {
        totalMillimes?: number;
        depositMillimes?: number;
        dailyRateMillimes?: number;
      }) => ctx.prisma.booking.update({ where: { id: 'a_done' }, data });
      await expectRefused(update({ totalMillimes: -1 }), 'bookings_total_nonnegative_check');
      await expectRefused(update({ depositMillimes: -1 }), 'bookings_deposit_nonnegative_check');
      await expectRefused(update({ dailyRateMillimes: 0 }), 'bookings_daily_rate_positive_check');
      await update({ totalMillimes: 0, depositMillimes: 0 });

      const vehicle = (data: {
        dailyRateMillimes?: number;
        depositMillimes?: number;
        mileageKm?: number;
      }) => ctx.prisma.vehicle.update({ where: { id: vehicleId('checks') }, data });
      await expectRefused(vehicle({ dailyRateMillimes: 0 }), 'vehicles_daily_rate_positive_check');
      await expectRefused(
        vehicle({ dailyRateMillimes: -100 }),
        'vehicles_daily_rate_positive_check',
      );
      await expectRefused(vehicle({ depositMillimes: -1 }), 'vehicles_deposit_nonnegative_check');
      await expectRefused(vehicle({ mileageKm: -1 }), 'vehicles_mileage_nonnegative_check');

      const payment = (amountMillimes: number) =>
        ctx.prisma.payment.create({
          data: { bookingId: 'a_done', kind: 'REFUND', method: 'CASH', amountMillimes },
        });
      await expectRefused(payment(0), 'payments_amount_positive_check');
      await expectRefused(payment(-5_000), 'payments_amount_positive_check');

      const invoice = (period: string, totalMillimes: number) =>
        ctx.prisma.invoice.create({
          data: {
            number: `F-${period}`,
            agencyId: 'a_agency',
            period,
            plan: 'STARTER',
            subscriptionMillimes: 49_000,
            commissionMillimes: 0,
            subtotalMillimes: 49_000,
            vatRateBps: 1900,
            vatMillimes: 9_310,
            fiscalStampMillimes: 1_000,
            totalMillimes,
            issuedAt: new Date('2026-11-01T07:00:00Z'),
            dueAt: new Date('2026-11-15T22:59:00Z'),
          },
        });
      // 49,000 + 9,310 de TVA + 1,000 de timbre = 59,310 DT.
      await expectRefused(invoice('2026-08', 59_309), 'invoices_total_check');
      // Plusieurs CHECK en défaut : PostgreSQL les évalue par ordre alphabétique de nom.
      await expectRefused(invoice('2026-09', -1), 'invoices_amounts_nonnegative_check');
      await invoice('2026-10', 59_310);
    });
  });
});

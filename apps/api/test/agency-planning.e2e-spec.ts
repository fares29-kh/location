import type { BookingStatus, BookingView, PlanningData, VehicleMaintenance } from '@drivetn/types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AgencyTestApp,
  type AuthenticatedAgent,
  body,
  createAgencyTestApp,
  e2eEnabled,
} from './support/agency-app';
import { resetDatabase, seedSmallAgency } from './support/agency-fixtures';

/**
 * Planning : fenêtre [from, to[ bornée à minuit heure de Tunis, valeurs par défaut (veille,
 * 14 jours), 62 jours au plus, erreurs 400 explicites, réservations allégées et cloisonnement.
 * Ignoré sans `E2E_DATABASE_URL` / `E2E_REDIS_URL`.
 */

/** 00 h 30 à Tunis le 11 novembre, encore le 10 en UTC. */
const NOW = new Date('2026-11-10T23:30:00.000Z');
const FROM = '2026-12-01';
const TO = '2026-12-08';

const at = (iso: string) => new Date(iso);

/** Une réservation par véhicule : les cas restent valables avec l'exclusion des chevauchements. */
const CASES: {
  id: string;
  pickupAt: string;
  returnAt: string;
  status?: BookingStatus;
  inWindow: boolean;
}[] = [
  // Commence avant la fenêtre et finit dedans.
  {
    id: 'a_starts_before',
    pickupAt: '2026-11-28T09:00Z',
    returnAt: '2026-12-02T09:00Z',
    inWindow: true,
  },
  { id: 'a_inside', pickupAt: '2026-12-03T09:00Z', returnAt: '2026-12-05T09:00Z', inWindow: true },
  // Commence dedans et finit après.
  {
    id: 'a_ends_after',
    pickupAt: '2026-12-06T09:00Z',
    returnAt: '2026-12-10T09:00Z',
    inWindow: true,
  },
  { id: 'a_spans', pickupAt: '2026-11-25T09:00Z', returnAt: '2026-12-15T09:00Z', inWindow: true },
  // Rendue pile au début (minuit à Tunis = 23 h UTC la veille) : aucun chevauchement.
  {
    id: 'a_ends_at_start',
    pickupAt: '2026-11-27T09:00Z',
    returnAt: '2026-11-30T23:00Z',
    inWindow: false,
  },
  // Prise pile à la fin : aucun chevauchement.
  {
    id: 'a_starts_at_end',
    pickupAt: '2026-12-07T23:00Z',
    returnAt: '2026-12-09T09:00Z',
    inWindow: false,
  },
  // Rendue le 1er à 00 h 30 heure de Tunis (encore le 30 en UTC) : dans la fenêtre.
  {
    id: 'a_tunis_early',
    pickupAt: '2026-11-29T09:00Z',
    returnAt: '2026-11-30T23:30Z',
    inWindow: true,
  },
  // Prise le 8 à 00 h 30 heure de Tunis (encore le 7 en UTC) : hors fenêtre.
  {
    id: 'a_tunis_late',
    pickupAt: '2026-12-07T23:30Z',
    returnAt: '2026-12-09T09:00Z',
    inWindow: false,
  },
  {
    id: 'a_cancelled',
    pickupAt: '2026-12-03T09:00Z',
    returnAt: '2026-12-04T09:00Z',
    status: 'CANCELLED',
    inWindow: false,
  },
  {
    id: 'a_completed',
    pickupAt: '2026-12-02T09:00Z',
    returnAt: '2026-12-03T09:00Z',
    status: 'COMPLETED',
    inWindow: true,
  },
  // Fenêtre par défaut (10 au 24 novembre).
  {
    id: 'a_default',
    pickupAt: '2026-11-12T09:00Z',
    returnAt: '2026-11-14T09:00Z',
    inWindow: false,
  },
];

describe.skipIf(!e2eEnabled)('Portail agence : planning (e2e)', () => {
  let ctx: AgencyTestApp;
  let asA: AuthenticatedAgent;

  const planning = async (query: string) =>
    body<PlanningData>(await asA.get(`/planning${query}`).expect(200));

  const rejected = async (query: string) => {
    const response = await asA.get(`/planning${query}`).expect(400);
    return response.body as {
      code: string;
      message: string;
      details: { path: string; message: string }[];
    };
  };

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    ctx = await createAgencyTestApp();
    await resetDatabase(ctx.prisma);
    const ownerA = await seedSmallAgency(ctx.prisma, {
      tag: 'a',
      ownerPhone: '20000000',
      vehicles: CASES.map((item, index) => ({
        id: `${item.id}_v`,
        brand: 'Renault',
        model: 'Clio',
        plateNumber: `${String(100 + index)} TU 1000`,
      })),
      customers: [
        {
          id: 'a_c1',
          firstName: 'Hédi',
          lastName: 'Chaâbane',
          phone: '20123456',
          email: null,
          city: 'Gabès',
        },
      ],
      bookings: CASES.map((item) => ({
        id: item.id,
        vehicleId: `${item.id}_v`,
        customerId: 'a_c1',
        pickupAt: at(item.pickupAt),
        returnAt: at(item.returnAt),
        status: item.status,
      })),
    });
    await seedSmallAgency(ctx.prisma, {
      tag: 'b',
      ownerPhone: '50000000',
      vehicles: [{ id: 'b_v1', brand: 'Kia', model: 'Picanto', plateNumber: '200 TU 2000' }],
      customers: [
        {
          id: 'b_c1',
          firstName: 'Sarra',
          lastName: 'Gharbi',
          phone: '50123456',
          email: null,
          city: 'Tunis',
        },
      ],
      bookings: [
        {
          id: 'b_inside',
          vehicleId: 'b_v1',
          customerId: 'b_c1',
          pickupAt: at('2026-12-03T09:00Z'),
          returnAt: at('2026-12-05T09:00Z'),
        },
      ],
    });
    asA = ctx.as(ownerA);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await ctx.app.close();
  });

  it('ne renvoie que les réservations actives qui chevauchent [from, to[ (minuits de Tunis)', async () => {
    const data = await planning(`?from=${FROM}&to=${TO}`);
    expect(data).toMatchObject({ from: FROM, to: TO, days: 7 });
    const expected = CASES.filter((item) => item.inWindow).map((item) => item.id);
    expect(data.bookings.map((booking) => booking.id).sort()).toEqual([...expected].sort());
    expect(data.bookings.map((booking) => booking.pickupAt)).toEqual(
      [...data.bookings.map((booking) => booking.pickupAt)].sort(),
    );
    expect(data.vehicles).toHaveLength(CASES.length);
    expect(data.vehicles.every((vehicle) => vehicle.id.startsWith('a_'))).toBe(true);
  });

  it('accepte `days` à la place de `to`, ou les deux s’ils concordent', async () => {
    const byDays = await planning(`?from=${FROM}&days=7`);
    expect(byDays).toEqual(await planning(`?from=${FROM}&to=${TO}`));
    expect(await planning(`?from=${FROM}&to=${TO}&days=7`)).toEqual(byDays);
  });

  it('par défaut : de la veille (jour de Tunis) sur 14 jours', async () => {
    const data = await planning('');
    expect(data).toMatchObject({ from: '2026-11-10', to: '2026-11-24', days: 14 });
    expect(data.bookings.map((booking) => booking.id)).toEqual(['a_default']);
    expect(await planning('?days=3')).toMatchObject({ from: '2026-11-10', to: '2026-11-13' });
    expect(await planning('?to=2026-11-20')).toMatchObject({ from: '2026-11-10', days: 10 });
    expect(await planning(`?from=${FROM}`)).toMatchObject({ to: '2026-12-15', days: 14 });
  });

  it('accepte 62 jours au plus et rejette une fenêtre vide, inversée ou trop longue (400)', async () => {
    expect(await planning(`?from=${FROM}&to=2027-02-01`)).toMatchObject({ days: 62 });
    expect(await planning(`?from=${FROM}&days=62`)).toMatchObject({ to: '2027-02-01' });

    for (const query of [`?from=${FROM}&to=${FROM}`, `?from=${TO}&to=${FROM}`, '?to=2026-11-10']) {
      const error = await rejected(query);
      expect(error.code, query).toBe('VALIDATION_ERROR');
      expect(error.message).toBe(
        'La fin du planning doit être postérieure à son début (to > from).',
      );
      expect(error.details).toEqual([{ path: 'to', message: 'END_NOT_AFTER_START' }]);
    }
    for (const days of ['0', '-3']) {
      expect((await rejected(`?from=${FROM}&days=${days}`)).details).toEqual([
        { path: 'days', message: 'END_NOT_AFTER_START' },
      ]);
    }

    const tooLong = await rejected(`?from=${FROM}&to=2027-02-02`);
    expect(tooLong.message).toBe('Le planning couvre au plus 62 jours.');
    expect(tooLong.details).toEqual([{ path: 'to', message: 'WINDOW_TOO_LONG' }]);
    expect((await rejected(`?from=${FROM}&days=63`)).details).toEqual([
      { path: 'days', message: 'WINDOW_TOO_LONG' },
    ]);
    expect((await rejected(`?from=${FROM}&days=100000000`)).details).toEqual([
      { path: 'days', message: 'WINDOW_TOO_LONG' },
    ]);

    const conflict = await rejected(`?from=${FROM}&to=${TO}&days=5`);
    expect(conflict.details).toEqual([{ path: 'to', message: 'WINDOW_CONFLICT' }]);
    expect(conflict.message).toContain('pas les deux');
  });

  it('rejette les dates et durées mal formées (400)', async () => {
    for (const query of [
      '?from=2026-02-30',
      '?from=01/12/2026',
      '?to=demain',
      '?days=abc',
      '?days=2.5',
    ]) {
      const error = await rejected(query);
      expect(error.code, query).toBe('VALIDATION_ERROR');
      expect(error.details.length, query).toBeGreaterThan(0);
    }
    expect((await rejected('?from=2026-02-30')).details).toEqual([
      { path: 'from', message: 'INVALID_DATE' },
    ]);
  });

  it('renvoie des réservations allégées ; le détail complet passe par GET /bookings/:id', async () => {
    const data = await planning(`?from=${FROM}&to=${TO}`);
    const [booking] = data.bookings;
    if (booking === undefined) {
      throw new Error('planning vide');
    }
    expect(Object.keys(booking).sort()).toEqual(
      [
        'customer',
        'id',
        'pickupAt',
        'reference',
        'returnAt',
        'status',
        'totalMillimes',
        'vehicleId',
      ].sort(),
    );
    expect(booking.customer).toEqual({ id: 'a_c1', firstName: 'Hédi', lastName: 'Chaâbane' });

    const detail = body<BookingView>(await asA.get(`/bookings/${booking.id}`).expect(200));
    expect(detail).toMatchObject({
      id: booking.id,
      reference: booking.reference,
      vehicleId: booking.vehicleId,
      status: booking.status,
      pickupAt: booking.pickupAt,
      returnAt: booking.returnAt,
      totalMillimes: booking.totalMillimes,
      customer: booking.customer,
    });
    expect(detail.history).toBeDefined();
    expect(detail.payments).toBeDefined();
  });

  it('ne montre jamais les réservations d’une autre agence', async () => {
    const data = await planning(`?from=${FROM}&to=${TO}`);
    expect(data.bookings.some((booking) => booking.id === 'b_inside')).toBe(false);
    expect(data.vehicles.some((vehicle) => vehicle.id === 'b_v1')).toBe(false);
    await asA.get('/bookings/b_inside').expect(404);
  });

  it('planifie un entretien sur des jours libres, refuse les chevauchements et le supprime', async () => {
    const created = body<VehicleMaintenance>(
      await asA
        .post('/vehicles/a_inside_v/maintenances')
        .send({ from: '2026-12-06', to: '2026-12-07', note: ' Vidange ' })
        .expect(201),
    );
    expect(created).toMatchObject({
      vehicleId: 'a_inside_v',
      from: '2026-12-06',
      to: '2026-12-07',
      note: 'Vidange',
    });
    expect((await planning(`?from=${FROM}&to=${TO}`)).maintenances).toEqual([created]);
    expect((await planning('?from=2026-12-08&days=3')).maintenances).toEqual([]);

    // La location a_inside est rendue le 5 en milieu de journée.
    const withBooking = await asA
      .post('/vehicles/a_inside_v/maintenances')
      .send({ from: '2026-12-05', to: '2026-12-05' })
      .expect(409);
    expect(withBooking.body).toMatchObject({
      code: 'CONFLICT',
      details: { reason: 'BOOKINGS_OVERLAP', bookings: [{ id: 'a_inside' }] },
    });
    await asA
      .post('/vehicles/a_inside_v/maintenances')
      .send({ from: '2026-12-07', to: '2026-12-09' })
      .expect(409);

    const inverted = await asA
      .post('/vehicles/a_inside_v/maintenances')
      .send({ from: '2026-12-09', to: '2026-12-08' })
      .expect(400);
    expect(inverted.body).toMatchObject({ details: [{ path: 'to', message: 'END_BEFORE_START' }] });
    await asA
      .post('/vehicles/b_v1/maintenances')
      .send({ from: '2026-12-10', to: '2026-12-10' })
      .expect(404);

    await asA.delete(`/vehicles/a_inside_v/maintenances/${created.id}`).expect(204);
    await asA.delete(`/vehicles/a_inside_v/maintenances/${created.id}`).expect(404);
    expect((await planning(`?from=${FROM}&to=${TO}`)).maintenances).toEqual([]);
  });
});

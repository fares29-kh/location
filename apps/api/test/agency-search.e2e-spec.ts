import type { BookingList, BookingView, CustomerView } from '@drivetn/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  allPages,
  type AuthenticatedAgent,
  type AgencyTestApp,
  createAgencyTestApp,
  e2eEnabled,
} from './support/agency-app';
import { resetDatabase, seedSmallAgency } from './support/agency-fixtures';

/**
 * Recherche de l'espace agence : insensible à la casse et aux accents (noms, e-mails, villes,
 * marques), immatriculation sans espaces ni tirets, `%`, `_` et `\` littéraux, et jamais de
 * résultat d'une autre agence. Ignoré sans `E2E_DATABASE_URL` / `E2E_REDIS_URL`.
 */

describe.skipIf(!e2eEnabled)('Portail agence : recherche (e2e)', () => {
  let ctx: AgencyTestApp;
  let asA: AuthenticatedAgent;
  let asB: AuthenticatedAgent;

  const bookingIds = async (agent: AuthenticatedAgent, search: string) =>
    (
      await allPages<BookingView, BookingList>(
        agent,
        `/bookings?search=${encodeURIComponent(search)}`,
      )
    )
      .flatMap((page) => page.items.map((booking) => booking.id))
      .sort();

  const customerIds = async (agent: AuthenticatedAgent, search: string) =>
    (await allPages<CustomerView>(agent, `/customers?search=${encodeURIComponent(search)}`))
      .flatMap((page) => page.items.map((customer) => customer.id))
      .sort();

  beforeAll(async () => {
    ctx = await createAgencyTestApp();
    await resetDatabase(ctx.prisma);
    const ownerA = await seedSmallAgency(ctx.prisma, {
      tag: 'a',
      ownerPhone: '20000000',
      vehicles: [
        { id: 'a_v1', brand: 'Citroën', model: 'C3 Aircross', plateNumber: '123 TU 4567' },
        { id: 'a_v2', brand: 'Renault', model: 'Clio', plateNumber: '98 TU 102' },
      ],
      customers: [
        {
          id: 'a_c1',
          firstName: 'Hédi',
          lastName: 'Chaâbane',
          phone: '20123456',
          email: 'hedi.chaabane@exemple.tn',
          city: 'Gabès',
        },
        {
          id: 'a_c2',
          firstName: 'Ines',
          lastName: 'Remise_50%',
          phone: '20999888',
          email: null,
          city: 'Tunis',
        },
        {
          id: 'a_c3',
          firstName: 'Sarra',
          lastName: 'Ben Salah',
          phone: '20777666',
          email: 'sarra.bensalah@exemple.tn',
          city: 'Médenine',
        },
      ],
      bookings: [
        { id: 'a_b1', vehicleId: 'a_v1', customerId: 'a_c1' },
        { id: 'a_b2', vehicleId: 'a_v2', customerId: 'a_c2' },
        { id: 'a_b3', vehicleId: 'a_v2', customerId: 'a_c3' },
      ],
    });
    const ownerB = await seedSmallAgency(ctx.prisma, {
      tag: 'b',
      ownerPhone: '50000000',
      vehicles: [{ id: 'b_v1', brand: 'Citroën', model: 'C4', plateNumber: '123 TU 4567' }],
      customers: [
        {
          id: 'b_c1',
          firstName: 'Hédi',
          lastName: 'Gharbi',
          phone: '50123456',
          email: 'hedi.gharbi@exemple.tn',
          city: 'Gabès',
        },
      ],
      bookings: [{ id: 'b_b1', vehicleId: 'b_v1', customerId: 'b_c1' }],
    });
    asA = ctx.as(ownerA);
    asB = ctx.as(ownerB);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('réservations : noms et marques sans tenir compte des accents ni de la casse', async () => {
    for (const term of [
      'hedi',
      'HÉDI',
      'Hédi',
      'chaabane',
      'CHAÂBANE hedi',
      'citroen',
      'CITROËN',
    ]) {
      expect(await bookingIds(asA, term), term).toEqual(['a_b1']);
    }
    expect(await bookingIds(asA, 'ben salah')).toEqual(['a_b3']);
    expect(await bookingIds(asA, 'a-0002')).toEqual(['a_b2']);
    expect(await bookingIds(asA, '123456')).toEqual(['a_b1']);
  });

  it('réservations : immatriculation sans espaces ni tirets', async () => {
    for (const term of ['123TU4567', '123-TU-4567', '123 tu 4567', 'tu4567', '3TU45']) {
      expect(await bookingIds(asA, term), term).toEqual(['a_b1']);
    }
    expect(await bookingIds(asA, '98TU102')).toEqual(['a_b2', 'a_b3']);
    expect(await bookingIds(asA, '123TU4568')).toEqual([]);
  });

  it('clients : noms, e-mails et villes sans tenir compte des accents ni de la casse', async () => {
    expect(await customerIds(asA, 'gabes')).toEqual(['a_c1']);
    expect(await customerIds(asA, 'GABÈS')).toEqual(['a_c1']);
    expect(await customerIds(asA, 'hedi')).toEqual(['a_c1']);
    expect(await customerIds(asA, 'medenine')).toEqual(['a_c3']);
    expect(await customerIds(asA, 'Exemple.TN')).toEqual(['a_c1', 'a_c3']);
    expect(await customerIds(asA, 'hedi gabes')).toEqual(['a_c1']);
    expect(await customerIds(asA, '999888')).toEqual(['a_c2']);
  });

  it('`%`, `_` et `\\` restent littéraux', async () => {
    for (const term of ['%', '_', '_50%', 'e_5']) {
      expect(await bookingIds(asA, term), term).toEqual(['a_b2']);
      expect(await customerIds(asA, term), term).toEqual(['a_c2']);
    }
    for (const term of ['h_di', 'H%i', 'R%e', '\\', '50\\%']) {
      expect(await bookingIds(asA, term), term).toEqual([]);
      expect(await customerIds(asA, term), term).toEqual([]);
    }
  });

  it('ne renvoie jamais les données d’une autre agence', async () => {
    expect(await bookingIds(asB, 'hedi')).toEqual(['b_b1']);
    expect(await bookingIds(asB, '123TU4567')).toEqual(['b_b1']);
    expect(await customerIds(asB, 'gabes')).toEqual(['b_c1']);
    expect(await bookingIds(asB, 'chaabane')).toEqual([]);
    expect(await customerIds(asB, 'exemple')).toEqual(['b_c1']);
    expect(await bookingIds(asA, 'gharbi')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  AGENCY_LIST_LIMIT_DEFAULT,
  AGENCY_LIST_LIMIT_MAX,
  bookingQuerySchema,
  customerQuerySchema,
  deskBookingSchema,
  paymentQuerySchema,
} from './agency-portal';

describe('limite des listes du portail agence', () => {
  const schemas = { bookingQuerySchema, customerQuerySchema, paymentQuerySchema };

  it.each(Object.entries(schemas))('%s : défaut, plafond et valeurs invalides', (_name, schema) => {
    const limit = (value: unknown) =>
      schema.parse(value === undefined ? {} : { limit: value }).limit;
    expect(limit(undefined)).toBe(AGENCY_LIST_LIMIT_DEFAULT);
    expect(limit('1')).toBe(1);
    expect(limit('50')).toBe(50);
    expect(limit(String(AGENCY_LIST_LIMIT_MAX))).toBe(AGENCY_LIST_LIMIT_MAX);
    expect(limit('101')).toBe(AGENCY_LIST_LIMIT_MAX);
    expect(limit('100000')).toBe(AGENCY_LIST_LIMIT_MAX);
    for (const invalid of ['0', '-1', '2.5', 'abc', '']) {
      expect(limit(invalid), invalid).toBe(AGENCY_LIST_LIMIT_DEFAULT);
    }
  });

  it('garde les autres paramètres et leurs valeurs par défaut', () => {
    expect(bookingQuerySchema.parse({ page: '3', limit: '40', sort: 'inconnu' })).toEqual({
      filter: 'all',
      search: '',
      sort: 'pickup_desc',
      page: 3,
      limit: 40,
    });
  });
});

describe('réservation au comptoir', () => {
  const valid = {
    vehicleId: 'veh_1',
    pickup: '2026-10-25',
    return: '2026-10-28',
    phone: '20 123 456',
    firstName: 'Amine',
    lastName: 'Ben Ali',
    note: '  Vol TU 704  ',
  };

  it('normalise le téléphone et la note', () => {
    expect(deskBookingSchema.parse(valid)).toEqual({
      ...valid,
      phone: '20123456',
      note: 'Vol TU 704',
    });
  });

  it('refuse un retour le jour du départ', () => {
    const result = deskBookingSchema.safeParse({ ...valid, return: valid.pickup });
    expect(result.success).toBe(false);
  });
});

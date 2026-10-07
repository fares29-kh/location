import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  dayRange,
  diffInDays,
  isoWeekday,
  toDayKey,
  toMonthKey,
  tunisDateTime,
} from './dates';

describe('jours calendaires de l’agence', () => {
  it('évalue le jour dans le fuseau de Tunis', () => {
    expect(toDayKey('2026-10-07T23:30:00Z')).toBe('2026-10-08');
    expect(toDayKey('2026-10-07T22:59:00Z')).toBe('2026-10-07');
  });

  it('additionne et compare des jours, y compris en changeant de mois', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffInDays('2026-10-07', '2026-10-21')).toBe(14);
    expect(dayRange('2026-12-30', 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });

  it('gère les mois et les jours de la semaine', () => {
    expect(addMonths('2026-01', -2)).toBe('2025-11');
    expect(toMonthKey('2026-10-31T23:30:00Z')).toBe('2026-11');
    expect(isoWeekday('2026-10-05')).toBe(0);
    expect(isoWeekday('2026-10-11')).toBe(6);
  });

  it('convertit une heure locale de Tunis en instant UTC', () => {
    expect(tunisDateTime('2026-10-07', 10, 30).toISOString()).toBe('2026-10-07T09:30:00.000Z');
  });
});

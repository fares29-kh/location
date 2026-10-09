import { describe, expect, it } from 'vitest';

import { AppException } from '../common/errors/app.exception';
import { planningWindow } from './planning-window';

function rejection(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    return (error as AppException).getResponse();
  }
  throw new Error('aucune erreur levée');
}

describe('planningWindow', () => {
  it('borne la fenêtre à minuit heure de Tunis', () => {
    expect(planningWindow({ from: '2026-12-01', to: '2026-12-08' })).toEqual({
      from: '2026-12-01',
      to: '2026-12-08',
      days: 7,
      start: new Date('2026-11-30T23:00:00.000Z'),
      end: new Date('2026-12-07T23:00:00.000Z'),
    });
  });

  it('prend la veille du jour de Tunis et 14 jours par défaut', () => {
    // 00 h 30 le 1er janvier à Tunis, encore le 31 décembre en UTC.
    const now = new Date('2026-12-31T23:30:00.000Z');
    expect(planningWindow({}, now)).toMatchObject({
      from: '2026-12-31',
      to: '2027-01-14',
      days: 14,
    });
    expect(planningWindow({ days: 3 }, now)).toMatchObject({
      from: '2026-12-31',
      to: '2027-01-03',
    });
  });

  it('rejette une fenêtre vide, inversée, trop longue ou contradictoire', () => {
    expect(rejection(() => planningWindow({ from: '2026-12-08', to: '2026-12-01' }))).toMatchObject(
      {
        code: 'VALIDATION_ERROR',
        details: [{ path: 'to', message: 'END_NOT_AFTER_START' }],
      },
    );
    expect(rejection(() => planningWindow({ from: '2026-12-01', days: 63 }))).toMatchObject({
      message: 'Le planning couvre au plus 62 jours.',
      details: [{ path: 'days', message: 'WINDOW_TOO_LONG' }],
    });
    expect(rejection(() => planningWindow({ from: '2026-12-01', to: '2027-02-02' }))).toMatchObject(
      {
        details: [{ path: 'to', message: 'WINDOW_TOO_LONG' }],
      },
    );
    expect(
      rejection(() => planningWindow({ from: '2026-12-01', to: '2026-12-08', days: 6 })),
    ).toMatchObject({ details: [{ path: 'to', message: 'WINDOW_CONFLICT' }] });
    expect(planningWindow({ from: '2026-12-01', to: '2027-02-01' }).days).toBe(62);
  });
});

import {
  addDays,
  type DayKey,
  diffInDays,
  PLANNING_DAYS_DEFAULT,
  PLANNING_DAYS_MAX,
  type PlanningQuery,
  todayKey,
  tunisDateTime,
} from '@drivetn/types';
import { HttpStatus } from '@nestjs/common';

import { AppException } from '../common/errors/app.exception';

/** Jours [from, to[ du planning et instants correspondants (minuit, heure de Tunis). */
export interface PlanningWindow {
  from: DayKey;
  to: DayKey;
  days: number;
  start: Date;
  end: Date;
}

function invalidWindow(path: string, code: string, message: string): AppException {
  return new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message, [
    { path, message: code },
  ]);
}

const END_NOT_AFTER_START = 'La fin du planning doit être postérieure à son début (to > from).';
const WINDOW_TOO_LONG = `Le planning couvre au plus ${String(PLANNING_DAYS_MAX)} jours.`;

/**
 * Fenêtre demandée : `from` vaut par défaut la veille (jour de Tunis), la fin `to` (exclue)
 * vaut `from` + `days`, 14 jours par défaut. `to` et `days` ensemble doivent concorder.
 */
export function planningWindow(query: PlanningQuery, now: Date = new Date()): PlanningWindow {
  const from = query.from ?? addDays(todayKey(now), -1);
  if (query.days !== undefined) {
    if (query.days <= 0) {
      throw invalidWindow('days', 'END_NOT_AFTER_START', END_NOT_AFTER_START);
    }
    if (query.days > PLANNING_DAYS_MAX) {
      throw invalidWindow('days', 'WINDOW_TOO_LONG', WINDOW_TOO_LONG);
    }
    if (query.to !== undefined && addDays(from, query.days) !== query.to) {
      throw invalidWindow(
        'to',
        'WINDOW_CONFLICT',
        'Indiquez la fin du planning par « to » ou par « days », pas les deux avec des valeurs différentes.',
      );
    }
  }
  const to = query.to ?? addDays(from, query.days ?? PLANNING_DAYS_DEFAULT);
  const days = diffInDays(from, to);
  if (days <= 0) {
    throw invalidWindow('to', 'END_NOT_AFTER_START', END_NOT_AFTER_START);
  }
  if (days > PLANNING_DAYS_MAX) {
    throw invalidWindow('to', 'WINDOW_TOO_LONG', WINDOW_TOO_LONG);
  }
  return { from, to, days, start: tunisDateTime(from, 0), end: tunisDateTime(to, 0) };
}

/**
 * Jours calendaires de l'agence, toujours évalués dans le fuseau `Africa/Tunis`
 * (un jour est représenté par sa clé « AAAA-MM-JJ »), indépendamment du fuseau du navigateur.
 */
export const AGENCY_TIME_ZONE = 'Africa/Tunis';

export type DayKey = string;

const DAY_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: AGENCY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 86_400_000;

export function toDayKey(value: Date | string): DayKey {
  return DAY_KEY_FORMAT.format(typeof value === 'string' ? new Date(value) : value);
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

/** Midi UTC du jour : une date sans ambiguïté pour l'affichage avec `Africa/Tunis`. */
export function dayKeyToDate(day: DayKey): Date {
  return new Date(`${day}T12:00:00Z`);
}

export function addDays(day: DayKey, amount: number): DayKey {
  return new Date(dayKeyToDate(day).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

export function diffInDays(from: DayKey, to: DayKey): number {
  return Math.round((dayKeyToDate(to).getTime() - dayKeyToDate(from).getTime()) / DAY_MS);
}

export function dayRange(from: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/** Clé « AAAA-MM » du mois d'une date, dans le fuseau de l'agence. */
export function toMonthKey(value: Date | string): string {
  return toDayKey(value).slice(0, 7);
}

export function addMonths(monthKey: string, amount: number): string {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return date.toISOString().slice(0, 7);
}

/** Jour de la semaine (0 = lundi … 6 = dimanche). */
export function isoWeekday(day: DayKey): number {
  return (dayKeyToDate(day).getUTCDay() + 6) % 7;
}

/** Instant UTC correspondant à une heure locale de Tunis (UTC+1, sans heure d'été). */
export function tunisDateTime(day: DayKey, hour: number, minute = 0): Date {
  return new Date(Date.UTC(...dayParts(day), hour - 1, minute));
}

function dayParts(day: DayKey): [number, number, number] {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return [year, month - 1, date];
}

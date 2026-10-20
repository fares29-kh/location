import { BLOCKING_BOOKING_STATUSES, type BookingStatus } from '@drivetn/types';

import { addDays, type DayKey, tunisDateTime } from '@/lib/agency/dates';
import type { PlanningBooking, PlanningData, VehicleMaintenance } from '@/lib/agency/types';

/** Intervalle [start, end[ en millisecondes. */
export interface TimeRange {
  start: number;
  end: number;
}

const PLANNED_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
];

/** Jours `from` à `to` inclus, de minuit à minuit (heure de Tunis). */
export function daysTimeRange(from: DayKey, to: DayKey): TimeRange {
  return {
    start: tunisDateTime(from, 0).getTime(),
    end: tunisDateTime(addDays(to, 1), 0).getTime(),
  };
}

export function bookingTimeRange(booking: PlanningBooking): TimeRange {
  return {
    start: new Date(booking.pickupAt).getTime(),
    end: new Date(booking.returnAt).getTime(),
  };
}

export function maintenanceTimeRange(maintenance: VehicleMaintenance): TimeRange {
  return daysTimeRange(maintenance.from, maintenance.to);
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function isBlocking(booking: PlanningBooking): boolean {
  return BLOCKING_BOOKING_STATUSES.includes(booking.status);
}

/** Jours où le véhicule est déjà pris : demande, réservation active ou entretien planifié. */
export function occupiedDays(
  vehicleId: string,
  data: Pick<PlanningData, 'bookings' | 'maintenances'>,
  days: readonly DayKey[],
): Set<DayKey> {
  const ranges = [
    ...data.bookings
      .filter((booking) => booking.vehicleId === vehicleId && isBlocking(booking))
      .map(bookingTimeRange),
    ...data.maintenances
      .filter((maintenance) => maintenance.vehicleId === vehicleId)
      .map(maintenanceTimeRange),
  ];
  return new Set(
    days.filter((day) => ranges.some((range) => overlaps(range, daysTimeRange(day, day)))),
  );
}

/** Véhicules louables toute la journée, jour par jour (statut « disponible » et rien de prévu). */
export function freeCountByDay(data: PlanningData, days: readonly DayKey[]): Map<DayKey, number> {
  const counts = new Map(days.map((day) => [day, 0]));
  for (const vehicle of data.vehicles) {
    if (vehicle.status !== 'ACTIVE') {
      continue;
    }
    const occupied = occupiedDays(vehicle.id, data, days);
    for (const day of days) {
      if (!occupied.has(day)) {
        counts.set(day, (counts.get(day) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export interface DaySummary {
  /** Véhicules en service (hors « hors service »). */
  total: number;
  free: number;
  departures: number;
  returns: number;
  inMaintenance: number;
}

/** Résumé d'une journée : départs confirmés, retours attendus, véhicules libres ou à l'atelier. */
export function daySummary(data: PlanningData, day: DayKey): DaySummary {
  const range = daysTimeRange(day, day);
  const inRange = (iso: string) => {
    const time = new Date(iso).getTime();
    return time >= range.start && time < range.end;
  };
  const inMaintenance = data.vehicles.filter(
    (vehicle) =>
      vehicle.status === 'MAINTENANCE' ||
      data.maintenances.some(
        (maintenance) =>
          maintenance.vehicleId === vehicle.id && day >= maintenance.from && day <= maintenance.to,
      ),
  ).length;
  return {
    total: data.vehicles.length,
    free: freeCountByDay(data, [day]).get(day) ?? 0,
    departures: data.bookings.filter(
      (booking) => booking.status === 'CONFIRMED' && inRange(booking.pickupAt),
    ).length,
    returns: data.bookings.filter(
      (booking) => booking.status === 'PICKED_UP' && inRange(booking.returnAt),
    ).length,
    inMaintenance,
  };
}

/** Part de la période couverte par des réservations confirmées (0 à 1). */
export function plannedRate(
  vehicleId: string,
  bookings: readonly PlanningBooking[],
  range: TimeRange,
): number {
  const busy = bookings
    .filter(
      (booking) => booking.vehicleId === vehicleId && PLANNED_STATUSES.includes(booking.status),
    )
    .reduce((sum, booking) => {
      const { start, end } = bookingTimeRange(booking);
      return sum + Math.max(0, Math.min(end, range.end) - Math.max(start, range.start));
    }, 0);
  return Math.min(1, busy / (range.end - range.start));
}

/** Position d'une période dans la frise, en pourcentage, et si elle déborde à gauche ou à droite. */
export function placeInRange(period: TimeRange, range: TimeRange) {
  const start = Math.max(period.start, range.start);
  const end = Math.min(period.end, range.end);
  const total = range.end - range.start;
  return {
    visible: end > start,
    offset: ((start - range.start) / total) * 100,
    width: ((end - start) / total) * 100,
    clippedStart: period.start < range.start,
    clippedEnd: period.end > range.end,
  };
}

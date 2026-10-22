'use client';

import {
  addDays,
  addMonths,
  dayKeyToDate,
  dayRange,
  isDayOccupied,
  isoWeekday,
  selectRentalDay,
  type UnavailableRange,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

const WEEK_START = '2026-10-05';

function daysInMonth(month: string): number {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function MonthGrid({
  month,
  pickup,
  dropoff,
  ranges,
  today,
  locale,
  occupiedLabel,
  weekdays,
  onPick,
}: {
  month: string;
  pickup: string;
  dropoff: string;
  ranges: readonly UnavailableRange[];
  today: string;
  locale: string;
  occupiedLabel: string;
  weekdays: readonly string[];
  onPick: (day: string) => void;
}) {
  const dayFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
        day: 'numeric',
        month: 'long',
        timeZone: 'Africa/Tunis',
      }),
    [locale],
  );
  const title = useMemo(
    () =>
      new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Tunis',
      }).format(dayKeyToDate(`${month}-01`)),
    [locale, month],
  );
  const first = `${month}-01`;
  const days = dayRange(first, daysInMonth(month));
  const lead = isoWeekday(first);

  return (
    <div className="grid gap-2">
      <p className="text-center text-sm font-semibold capitalize">{title}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((label, index) => (
          <span key={`${month}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {days.map((day) => {
          const occupied = day >= today && isDayOccupied(day, ranges);
          const past = day < today;
          const selected = day === pickup || day === dropoff;
          const inside = pickup.length > 0 && dropoff.length > 0 && day > pickup && day < dropoff;
          const disabled = past || occupied;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={
                occupied
                  ? `${dayFormat.format(dayKeyToDate(day))}, ${occupiedLabel}`
                  : dayFormat.format(dayKeyToDate(day))
              }
              onClick={() => {
                onPick(day);
              }}
              className={cn(
                'flex h-9 items-center justify-center rounded-control text-sm tabular-nums',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'bg-primary font-semibold text-primary-foreground',
                inside && !selected && 'bg-primary/15 text-foreground',
                occupied && 'bg-danger/10 text-danger line-through',
                past && 'text-muted-foreground/40',
                !disabled && !selected && 'hover:bg-surface-muted',
                disabled && 'cursor-not-allowed',
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Deux mois, jours déjà confirmés barrés. Le retour d'une location reste cliquable : la voiture part à 10 h. */
export function AvailabilityCalendar({
  pickup,
  dropoff,
  ranges,
  today,
  locale,
  labels,
  onSelect,
  onOverlap,
}: {
  pickup: string;
  dropoff: string;
  ranges: readonly UnavailableRange[];
  today: string;
  locale: string;
  labels: { label: string; previous: string; next: string; occupied: string };
  onSelect: (pickup: string, dropoff: string) => void;
  onOverlap: () => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const lastMonth = addMonths(today.slice(0, 7), 11);
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
      weekday: 'narrow',
      timeZone: 'Africa/Tunis',
    });
    return dayRange(WEEK_START, 7).map((day) => format.format(dayKeyToDate(day)));
  }, [locale]);

  const pick = (day: string) => {
    const choice = selectRentalDay(
      { pickup: pickup.length > 0 ? pickup : null, return: dropoff.length > 0 ? dropoff : null },
      day,
      ranges,
      today,
    );
    if (choice.kind === 'rejected') {
      if (choice.reason === 'overlap') {
        onOverlap();
      }
      return;
    }
    onSelect(choice.pickup, choice.return ?? '');
  };

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{labels.label}</legend>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={labels.previous}
          disabled={month <= today.slice(0, 7)}
          onClick={() => {
            setMonth((current) => addMonths(current, -1));
          }}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={labels.next}
          disabled={month >= lastMonth}
          onClick={() => {
            setMonth((current) => addMonths(current, 1));
          }}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {[month, addMonths(month, 1)].map((shown) => (
          <MonthGrid
            key={shown}
            month={shown}
            pickup={pickup}
            dropoff={dropoff}
            ranges={ranges}
            today={today}
            locale={locale}
            occupiedLabel={labels.occupied}
            weekdays={weekdays}
            onPick={pick}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function lastOccupiedDay(range: UnavailableRange): string {
  return addDays(range.return, -1);
}

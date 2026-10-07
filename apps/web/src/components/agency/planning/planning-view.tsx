'use client';

import type { BookingStatus } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import { Skeleton } from '@drivetn/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type CSSProperties, useMemo } from 'react';

import { Link } from '@/i18n/navigation';
import {
  addDays,
  dayRange,
  type DayKey,
  isoWeekday,
  todayKey,
  tunisDateTime,
} from '@/lib/agency/dates';
import { usePlanning } from '@/lib/agency/queries';
import type { BookingView, PlanningData, Vehicle } from '@/lib/agency/types';

import { FilterTabs } from '../filter-tabs';
import { PageHeader } from '../page-header';
import { customerName } from '../people';
import { QueryError } from '../query-states';
import { type AgencyFormat, useAgencyFormat } from '../use-agency-format';
import { useNow } from '../use-now';
import { useUrlState } from '../use-url-state';
import { VehicleThumb } from '../vehicle-thumb';

const SPANS = ['7', '14', '30'] as const;
type Span = (typeof SPANS)[number];
const DAY_MS = 86_400_000;

const BAR_STYLES: Partial<Record<BookingStatus, string>> = {
  PENDING:
    'border border-dashed border-warning bg-warning-soft text-warning-soft-foreground hover:bg-warning-soft/80',
  CONFIRMED: 'bg-blue-600 text-white hover:bg-blue-700',
  PICKED_UP: 'bg-violet-600 text-white hover:bg-violet-700',
  RETURNED: 'bg-info text-white hover:bg-info/90',
  COMPLETED:
    'border border-border bg-surface-muted text-muted-foreground hover:bg-surface-muted/70',
};

const LEGEND: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
];
const PLANNED_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
];

interface Range {
  start: number;
  end: number;
}

function clampToRange(booking: BookingView, range: Range) {
  const pickup = new Date(booking.pickupAt).getTime();
  const dropoff = new Date(booking.returnAt).getTime();
  const start = Math.max(pickup, range.start);
  const end = Math.min(dropoff, range.end);
  return { start, end, clippedStart: pickup < range.start, clippedEnd: dropoff > range.end };
}

function BookingBar({
  booking,
  range,
  format,
}: {
  booking: BookingView;
  range: Range;
  format: AgencyFormat;
}) {
  const t = useTranslations('agency.planning');
  const tStatus = useTranslations('status.booking');
  const { start, end, clippedStart, clippedEnd } = clampToRange(booking, range);
  if (end <= start) {
    return null;
  }
  const total = range.end - range.start;
  const style: CSSProperties = {
    insetInlineStart: `${String(((start - range.start) / total) * 100)}%`,
    width: `${String(((end - start) / total) * 100)}%`,
  };
  const name = customerName(booking.customer);
  const dates = `${format.shortDateTime(booking.pickupAt)} – ${format.shortDateTime(booking.returnAt)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/bookings/${booking.id}`}
          style={style}
          aria-label={t('barLabel', { name, status: tStatus(booking.status), dates })}
          className={cn(
            'absolute top-1/2 flex h-9 min-w-2 -translate-y-1/2 items-center gap-1 overflow-hidden px-2 text-xs font-medium shadow-sm transition-colors',
            'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            clippedStart ? 'rounded-s-none' : 'rounded-s-control',
            clippedEnd ? 'rounded-e-none' : 'rounded-e-control',
            BAR_STYLES[booking.status],
          )}
        >
          <span className="truncate">{name}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="grid gap-0.5">
        <span className="font-semibold">
          {name} · {booking.reference}
        </span>
        <span>{dates}</span>
        <span>
          {tStatus(booking.status)} · {format.money(booking.totalMillimes)}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function plannedRate(vehicle: Vehicle, bookings: BookingView[], range: Range): number {
  const busy = bookings
    .filter(
      (booking) => booking.vehicleId === vehicle.id && PLANNED_STATUSES.includes(booking.status),
    )
    .reduce((sum, booking) => {
      const { start, end } = clampToRange(booking, range);
      return sum + Math.max(0, end - start);
    }, 0);
  return Math.min(1, busy / (range.end - range.start));
}

function Timeline({
  data,
  days,
  format,
}: {
  data: PlanningData;
  days: DayKey[];
  format: AgencyFormat;
}) {
  const t = useTranslations('agency.planning');
  const today = todayKey();
  const first = days[0] ?? today;
  const range: Range = {
    start: tunisDateTime(first, 0).getTime(),
    end: tunisDateTime(first, 0).getTime() + days.length * DAY_MS,
  };
  const now = useNow();
  const nowOffset =
    now >= range.start && now < range.end
      ? ((now - range.start) / (range.end - range.start)) * 100
      : null;
  const compact = days.length > 14;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(9rem, 14rem) repeat(${String(days.length)}, minmax(${compact ? '2.25rem' : '3.5rem'}, 1fr))`,
  };

  const dayCells = (row: string) =>
    days.map((day) => (
      <span
        key={`${row}-${day}`}
        className={cn(
          'border-s border-border/60',
          isoWeekday(day) >= 5 && 'bg-surface-muted/60',
          day === today && 'bg-primary/[0.07]',
        )}
      />
    ));

  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={t('title')} className="grid min-w-max" style={gridStyle}>
        <div role="row" className="contents">
          <span
            role="columnheader"
            className="sticky start-0 z-20 flex items-end border-b border-border bg-surface px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t('vehicle')}
          </span>
          {days.map((day) => {
            const isToday = day === today;
            const date = `${day}T12:00:00Z`;
            return (
              <span
                key={day}
                role="columnheader"
                className={cn(
                  'grid justify-items-center gap-0.5 border-b border-s border-border/60 py-2 text-xs',
                  isoWeekday(day) >= 5 && 'bg-surface-muted/60',
                  isToday && 'bg-primary/[0.07]',
                )}
              >
                {!compact && (
                  <span className="capitalize text-muted-foreground">
                    {format.weekdayShort(date)}
                  </span>
                )}
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full font-semibold tabular-nums',
                    isToday && 'bg-primary text-primary-foreground',
                  )}
                >
                  {Number(day.slice(8))}
                </span>
              </span>
            );
          })}
        </div>

        {data.vehicles.map((vehicle) => {
          const rate = plannedRate(vehicle, data.bookings, range);
          const maintenance = vehicle.status === 'MAINTENANCE';
          return (
            <div role="row" key={vehicle.id} className="group contents">
              <span
                role="rowheader"
                className="sticky start-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 group-last:border-b-0"
              >
                <VehicleThumb color={vehicle.color} className="hidden sm:flex" />
                <span className="grid min-w-0">
                  <span className="truncate text-sm font-medium">
                    {vehicle.brand} {vehicle.model}
                  </span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {vehicle.plateNumber} · {t('fillRate', { value: format.percent(rate) })}
                  </span>
                </span>
              </span>
              <div
                role="cell"
                className="relative grid min-h-16 border-b border-border group-last:border-b-0"
                style={{
                  gridColumn: `2 / span ${String(days.length)}`,
                  gridTemplateColumns: `repeat(${String(days.length)}, minmax(0, 1fr))`,
                }}
              >
                {dayCells(vehicle.id)}
                {maintenance ? (
                  <span
                    className="absolute inset-x-1 top-1/2 flex h-9 -translate-y-1/2 items-center justify-center gap-2 rounded-control border border-warning/40 text-xs font-medium text-warning-soft-foreground"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, hsl(var(--warning) / 0.14) 0 8px, transparent 8px 16px)',
                    }}
                  >
                    <Wrench className="size-3.5" aria-hidden="true" />
                    {t('maintenance')}
                  </span>
                ) : (
                  data.bookings
                    .filter((booking) => booking.vehicleId === vehicle.id)
                    .map((booking) => (
                      <BookingBar
                        key={booking.id}
                        booking={booking}
                        range={range}
                        format={format}
                      />
                    ))
                )}
                {nowOffset !== null && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-danger/70"
                    style={{ insetInlineStart: `${String(nowOffset)}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlanningView() {
  const t = useTranslations('agency.planning');
  const tStatus = useTranslations('status.booking');
  const format = useAgencyFormat();
  const defaults = useMemo(() => ({ from: addDays(todayKey(), -1), span: '14' }), []);
  const [params, setParams] = useUrlState(defaults, isValidParam);
  const span = Number(params.span);
  const days = useMemo(() => dayRange(params.from, span), [params.from, span]);
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = usePlanning(
    params.from,
    span,
  );
  const last = days.at(-1) ?? params.from;
  const step = span === 30 ? 28 : span;

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-control border border-border bg-surface shadow-sm">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('previous')}
              onClick={() => {
                setParams({ from: addDays(params.from, -step) });
              }}
            >
              <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border-x border-border"
              onClick={() => {
                setParams({ from: defaults.from });
              }}
            >
              {t('today')}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('next')}
              onClick={() => {
                setParams({ from: addDays(params.from, step) });
              }}
            >
              <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
          <p className="font-heading font-semibold tabular-nums" aria-live="polite">
            {format.dayMonth(`${params.from}T12:00:00Z`)} – {format.date(`${last}T12:00:00Z`)}
          </p>
        </div>
        <FilterTabs
          label={t('spanLabel')}
          value={params.span as Span}
          onValueChange={(value) => {
            setParams({ span: value });
          }}
          options={SPANS.map((value) => ({ value, label: t('span', { count: Number(value) }) }))}
        />
      </div>

      <ul
        className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
        aria-label={t('legend')}
      >
        {LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span className={cn('h-3 w-5 rounded-sm', BAR_STYLES[status])} aria-hidden="true" />
            {tStatus(status)}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="h-3 w-0.5 bg-danger/70" aria-hidden="true" />
          {t('now')}
        </li>
      </ul>

      {isPending ? (
        <Skeleton className="h-[32rem] rounded-card" />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <Card
          className={cn('overflow-hidden transition-opacity', isPlaceholderData && 'opacity-60')}
        >
          <Timeline data={data} days={days} format={format} />
        </Card>
      )}
      <p className="text-xs text-muted-foreground lg:hidden">{t('scrollHint')}</p>
    </div>
  );
}

function isValidParam(key: 'from' | 'span', value: string): boolean {
  return key === 'from'
    ? /^\d{4}-\d{2}-\d{2}$/.test(value)
    : (SPANS as readonly string[]).includes(value);
}

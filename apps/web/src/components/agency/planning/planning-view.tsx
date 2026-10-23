'use client';

import type { BookingStatus } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Skeleton } from '@drivetn/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import {
  CarFront,
  ChevronLeft,
  ChevronRight,
  Inbox,
  KeyRound,
  type LucideIcon,
  MoreHorizontal,
  Plus,
  Undo2,
  Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';

import { Link } from '@/i18n/navigation';
import { addDays, dayRange, type DayKey, isoWeekday, todayKey } from '@/lib/agency/dates';
import { useNavCounts, usePlanning } from '@/lib/agency/queries';
import type { PlanningBooking, PlanningData, Vehicle } from '@/lib/agency/types';
import { vehicleCoverUrl } from '@/lib/agency/vehicle-photos';

import { FilterTabs } from '../filter-tabs';
import { PageHeader } from '../page-header';
import { customerName } from '../people';
import { QueryError } from '../query-states';
import { SearchField } from '../search-field';
import { type AgencyFormat, useAgencyFormat } from '../use-agency-format';
import { useNow } from '../use-now';
import { useUrlState } from '../use-url-state';
import { matchesVehicleSearch } from '../vehicle-search';
import { VehicleGuards } from '../vehicle-status-items';
import { VehicleThumb } from '../vehicle-thumb';
import { MAINTENANCE_HATCH, MaintenanceBar } from './maintenance-bar';
import { MaintenanceDialog, type MaintenanceDraft } from './maintenance-dialog';
import {
  bookingTimeRange,
  daySummary,
  daysTimeRange,
  freeCountByDay,
  occupiedDays,
  placeInRange,
  plannedRate,
  type TimeRange,
} from './planning-model';

const SPANS = ['7', '14', '30'] as const;
type Span = (typeof SPANS)[number];

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

const noonOf = (day: DayKey) => `${day}T12:00:00Z`;

function BookingBar({
  booking,
  range,
  format,
}: {
  booking: PlanningBooking;
  range: TimeRange;
  format: AgencyFormat;
}) {
  const t = useTranslations('agency.planning');
  const tStatus = useTranslations('status.booking');
  const place = placeInRange(bookingTimeRange(booking), range);
  if (!place.visible) {
    return null;
  }
  const style: CSSProperties = {
    insetInlineStart: `${String(place.offset)}%`,
    width: `${String(place.width)}%`,
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
            place.clippedStart ? 'rounded-s-none' : 'rounded-s-control',
            place.clippedEnd ? 'rounded-e-none' : 'rounded-e-control',
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

function VehicleRowMenu({
  vehicle,
  onRent,
  onSchedule,
}: {
  vehicle: Vehicle;
  onRent: boolean;
  onSchedule: () => void;
}) {
  const t = useTranslations('agency.planning');
  const name = `${vehicle.brand} ${vehicle.model}`;
  return (
    <VehicleGuards vehicleId={vehicle.id} name={name} status={vehicle.status} onRent={onRent}>
      {({ statusItems, deleteItem }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              aria-label={t('rowMenu', { vehicle: name })}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={onSchedule}>
              <Wrench aria-hidden="true" />
              {t('scheduleMaintenance')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {statusItems}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/fleet?q=${encodeURIComponent(vehicle.plateNumber ?? name)}`}>
                <CarFront aria-hidden="true" />
                {t('viewInFleet')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {deleteItem}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </VehicleGuards>
  );
}

function OccupancyBar({ rate, format }: { rate: number; format: AgencyFormat }) {
  const t = useTranslations('agency.planning');
  const label = t('occupancy', { value: format.percent(rate) });
  return (
    <span className="flex items-center gap-2" title={label}>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rate * 100)}
        className="h-1 w-full max-w-24 overflow-hidden rounded-full bg-surface-muted"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${String(Math.round(rate * 100))}%` }}
        />
      </span>
      <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
        {format.percent(rate)}
      </span>
    </span>
  );
}

function Timeline({
  data,
  vehicles,
  days,
  format,
  onSchedule,
}: {
  data: PlanningData;
  vehicles: readonly Vehicle[];
  days: DayKey[];
  format: AgencyFormat;
  onSchedule: (draft: MaintenanceDraft) => void;
}) {
  const t = useTranslations('agency.planning');
  const today = todayKey();
  const first = days[0] ?? today;
  const range = daysTimeRange(first, days.at(-1) ?? first);
  const now = useNow();
  const nowOffset =
    now >= range.start && now < range.end
      ? ((now - range.start) / (range.end - range.start)) * 100
      : null;
  const compact = days.length > 14;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(12rem, 16rem) repeat(${String(days.length)}, minmax(${compact ? '2.25rem' : '3.5rem'}, 1fr))`,
  };
  const freeByDay = useMemo(() => freeCountByDay(data, days), [data, days]);
  const dayTone = (day: DayKey) =>
    cn(isoWeekday(day) >= 5 && 'bg-surface-muted/60', day === today && 'bg-primary/[0.07]');

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
            const free = freeByDay.get(day) ?? 0;
            const freeLabel = t('freeLabel', { count: free, date: format.dayMonth(noonOf(day)) });
            return (
              <span
                key={day}
                role="columnheader"
                className={cn(
                  'grid justify-items-center gap-1 border-b border-s border-border/60 py-2 text-xs',
                  dayTone(day),
                )}
              >
                {!compact && (
                  <span className="capitalize text-muted-foreground">
                    {format.weekdayShort(noonOf(day))}
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
                {day >= today ? (
                  <span
                    title={freeLabel}
                    aria-label={freeLabel}
                    className={cn(
                      'rounded-full px-1.5 text-[0.625rem] font-semibold tabular-nums leading-4',
                      free === 0
                        ? 'bg-danger-soft text-danger-soft-foreground'
                        : 'bg-success-soft text-success-soft-foreground',
                    )}
                  >
                    {compact ? free : t('free', { count: free })}
                  </span>
                ) : (
                  <span className="h-4" aria-hidden="true" />
                )}
              </span>
            );
          })}
        </div>

        {vehicles.length === 0 && (
          <div role="row" className="contents">
            <p
              role="cell"
              className="sticky start-0 col-span-full px-4 py-10 text-sm text-muted-foreground"
            >
              {t('noMatch')}
            </p>
          </div>
        )}

        {vehicles.map((vehicle) => {
          const name = `${vehicle.brand} ${vehicle.model}`;
          const bookings = data.bookings.filter((booking) => booking.vehicleId === vehicle.id);
          const maintenances = data.maintenances.filter(
            (maintenance) => maintenance.vehicleId === vehicle.id,
          );
          const occupied = occupiedDays(vehicle.id, data, days);
          const onRent = bookings.some((booking) => booking.status === 'PICKED_UP');
          const schedule = (from: DayKey) => {
            onSchedule({ vehicleId: vehicle.id, from });
          };
          return (
            <div role="row" key={vehicle.id} className="group contents">
              <span
                role="rowheader"
                className="sticky start-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5 group-last:border-b-0"
              >
                <VehicleThumb
                  color={vehicle.color}
                  photoUrl={vehicleCoverUrl(vehicle)}
                  className="hidden sm:flex"
                />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium" title={name}>
                    {name}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                    {vehicle.plateNumber !== null && (
                      <span className="whitespace-nowrap tabular-nums">{vehicle.plateNumber}</span>
                    )}
                    {vehicle.status === 'MAINTENANCE' && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-1.5 text-[0.625rem] font-semibold leading-4 text-warning-soft-foreground">
                        <Wrench className="size-2.5" aria-hidden="true" />
                        {t('maintenance')}
                      </span>
                    )}
                  </span>
                  <OccupancyBar
                    rate={plannedRate(vehicle.id, data.bookings, range)}
                    format={format}
                  />
                </span>
                <VehicleRowMenu
                  vehicle={vehicle}
                  onRent={onRent}
                  onSchedule={() => {
                    schedule(today);
                  }}
                />
              </span>
              <div
                role="cell"
                className="relative grid min-h-16 border-b border-border group-last:border-b-0"
                style={{
                  gridColumn: `2 / span ${String(days.length)}`,
                  gridTemplateColumns: `repeat(${String(days.length)}, minmax(0, 1fr))`,
                }}
              >
                {days.map((day) =>
                  day >= today && !occupied.has(day) ? (
                    <button
                      key={day}
                      type="button"
                      tabIndex={-1}
                      aria-label={t('scheduleOn', {
                        vehicle: name,
                        date: format.dayMonth(noonOf(day)),
                      })}
                      className={cn(
                        'group/day flex items-center justify-center border-s border-border/60 transition-colors hover:bg-warning-soft/60',
                        dayTone(day),
                      )}
                      onClick={() => {
                        schedule(day);
                      }}
                    >
                      <Plus
                        className="size-4 text-warning-soft-foreground opacity-0 transition-opacity group-hover/day:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    <span key={day} className={cn('border-s border-border/60', dayTone(day))} />
                  ),
                )}
                {vehicle.status === 'MAINTENANCE' && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ backgroundImage: MAINTENANCE_HATCH }}
                  />
                )}
                {maintenances.map((maintenance) => (
                  <MaintenanceBar
                    key={maintenance.id}
                    maintenance={maintenance}
                    vehicle={vehicle}
                    range={range}
                  />
                ))}
                {bookings.map((booking) => (
                  <BookingBar key={booking.id} booking={booking} range={range} format={format} />
                ))}
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

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
  href?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          tone === 'success' && 'bg-success-soft text-success-soft-foreground',
          tone === 'warning' && 'bg-warning-soft text-warning-soft-foreground',
          tone === 'info' && 'bg-info-soft text-info-soft-foreground',
          tone === 'neutral' && 'bg-surface-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="grid min-w-0">
        <span className="font-heading text-lg font-bold leading-tight tabular-nums">{value}</span>
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </>
  );
  const className =
    'flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 shadow-sm';
  return href === undefined ? (
    <li className={className}>{content}</li>
  ) : (
    <li className="contents">
      <Link
        href={href}
        className={cn(
          className,
          'transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {content}
      </Link>
    </li>
  );
}

/** Ce qui compte aujourd'hui, quelle que soit la période affichée. */
function TodaySummary() {
  const t = useTranslations('agency.planning.summary');
  const today = todayKey();
  const planning = usePlanning(today, 1);
  const navCounts = useNavCounts();
  if (planning.data === undefined) {
    return <Skeleton className="h-[3.75rem] rounded-card" />;
  }
  const summary = daySummary(planning.data, today);
  const pending = navCounts.data?.pendingBookings ?? 0;
  return (
    <section aria-label={t('title')}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile
          icon={CarFront}
          tone="success"
          label={t('free')}
          value={t('freeValue', { free: summary.free, total: summary.total })}
        />
        <SummaryTile
          icon={KeyRound}
          tone="info"
          label={t('departures')}
          value={summary.departures}
        />
        <SummaryTile icon={Undo2} tone="info" label={t('returns')} value={summary.returns} />
        <SummaryTile
          icon={Wrench}
          tone={summary.inMaintenance > 0 ? 'warning' : 'neutral'}
          label={t('maintenance')}
          value={summary.inMaintenance}
        />
        <SummaryTile
          icon={Inbox}
          tone={pending > 0 ? 'warning' : 'neutral'}
          label={t('pending')}
          value={pending}
          href="/bookings?filter=pending"
        />
      </ul>
    </section>
  );
}

export function PlanningView() {
  const t = useTranslations('agency.planning');
  const tStatus = useTranslations('status.booking');
  const format = useAgencyFormat();
  const defaults = useMemo(() => ({ from: addDays(todayKey(), -1), span: '14', q: '' }), []);
  const [params, setParams] = useUrlState(defaults, isValidParam);
  const [draft, setDraft] = useState<MaintenanceDraft | null>(null);
  const span = Number(params.span);
  const days = useMemo(() => dayRange(params.from, span), [params.from, span]);
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = usePlanning(
    params.from,
    span,
  );
  const last = days.at(-1) ?? params.from;
  const step = span === 30 ? 28 : span;
  const vehicles = (data?.vehicles ?? []).filter((vehicle) =>
    matchesVehicleSearch(vehicle, params.q),
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button
            disabled={data === undefined || data.vehicles.length === 0}
            onClick={() => {
              setDraft({ vehicleId: null, from: todayKey() });
            }}
          >
            <Wrench aria-hidden="true" />
            {t('scheduleMaintenance')}
          </Button>
        }
      />

      <TodaySummary />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
            {format.dayMonth(noonOf(params.from))} – {format.date(noonOf(last))}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={params.q}
            onValueChange={(q) => {
              setParams({ q });
            }}
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            className="sm:w-72"
          />
          <FilterTabs
            label={t('spanLabel')}
            value={params.span as Span}
            onValueChange={(value) => {
              setParams({ span: value });
            }}
            options={SPANS.map((value) => ({ value, label: t('span', { count: Number(value) }) }))}
          />
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-[32rem] rounded-card" />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.vehicles.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            <Button asChild>
              <Link href="/fleet">
                <Plus aria-hidden="true" />
                {t('emptyAction')}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          <Card
            className={cn('overflow-hidden transition-opacity', isPlaceholderData && 'opacity-60')}
          >
            <Timeline
              data={data}
              vehicles={vehicles}
              days={days}
              format={format}
              onSchedule={setDraft}
            />
          </Card>
          <div className="flex flex-col gap-3 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t('legend')}>
              {LEGEND.map((status) => (
                <li key={status} className="flex items-center gap-2">
                  <span
                    className={cn('h-3 w-5 rounded-sm', BAR_STYLES[status])}
                    aria-hidden="true"
                  />
                  {tStatus(status)}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span
                  className="h-3 w-5 rounded-sm border border-warning/50"
                  style={{ backgroundImage: MAINTENANCE_HATCH }}
                  aria-hidden="true"
                />
                {t('plannedMaintenance')}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3 w-0.5 bg-danger/70" aria-hidden="true" />
                {t('now')}
              </li>
            </ul>
            <p className="flex items-center gap-1.5">
              <Plus className="size-3.5 text-warning-soft-foreground" aria-hidden="true" />
              {t('clickHint')}
            </p>
          </div>
          <p className="text-xs text-muted-foreground lg:hidden">{t('scrollHint')}</p>
        </div>
      )}

      {draft !== null && data !== undefined && (
        <MaintenanceDialog
          vehicles={data.vehicles}
          draft={draft}
          onClose={() => {
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

function isValidParam(key: 'from' | 'span' | 'q', value: string): boolean {
  if (key === 'q') {
    return true;
  }
  return key === 'from'
    ? /^\d{4}-\d{2}-\d{2}$/.test(value)
    : (SPANS as readonly string[]).includes(value);
}

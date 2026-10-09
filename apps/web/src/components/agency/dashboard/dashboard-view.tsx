'use client';

import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import { Rating } from '@drivetn/ui/rating';
import { Skeleton } from '@drivetn/ui/skeleton';
import { StatCard } from '@drivetn/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CarFront,
  CheckCheck,
  CircleDollarSign,
  Clock,
  Gauge,
  KeyRound,
  Settings,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useDashboard } from '@/lib/agency/queries';
import type { BookingView, DashboardData, FleetBreakdown } from '@/lib/agency/types';

import { BookingActionsBar } from '../bookings/booking-actions';
import { PageHeader } from '../page-header';
import { customerName, CustomerIdentity } from '../people';
import { QueryError, StatCardsSkeleton } from '../query-states';
import { BookingStatusTag } from '../status-tags';
import { type AgencyFormat, useAgencyFormat } from '../use-agency-format';
import { useNow } from '../use-now';

/** Au-delà de ce délai, une demande sans réponse est signalée comme urgente. */
const URGENT_AFTER_MS = 2 * 3_600_000;

function variation(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

function Kpis({ data, format }: { data: DashboardData; format: AgencyFormat }) {
  const t = useTranslations('agency.dashboard.kpis');
  const { kpis, fleet } = data;
  const revenueTrend = variation(kpis.revenueMonthMillimes, kpis.revenuePreviousMonthMillimes);
  const bookingsTrend = variation(kpis.bookingsMonth, kpis.bookingsPreviousMonth);
  const trendText = (value: number | null) =>
    value === null
      ? t('noComparison')
      : t('versusLastMonth', { value: format.signedPercent(value) });
  const direction = (value: number | null) =>
    value === null || value === 0 ? 'neutral' : value > 0 ? 'up' : 'down';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('revenue')}
        value={format.money(kpis.revenueMonthMillimes)}
        icon={CircleDollarSign}
        trend={trendText(revenueTrend)}
        trendDirection={direction(revenueTrend)}
      />
      <StatCard
        label={t('bookings')}
        value={format.integer(kpis.bookingsMonth)}
        icon={CalendarCheck}
        trend={trendText(bookingsTrend)}
        trendDirection={direction(bookingsTrend)}
      />
      <StatCard
        label={t('occupancy')}
        value={format.percent(kpis.occupancyRate)}
        icon={Gauge}
        trend={t('onRentNow', { count: fleet.onRent })}
      />
      <StatCard
        label={t('outstanding')}
        value={format.money(kpis.outstandingMillimes)}
        icon={Wallet}
        trend={kpis.outstandingMillimes > 0 ? t('outstandingHint') : t('allCollected')}
        trendDirection={kpis.outstandingMillimes > 0 ? 'down' : 'up'}
      />
    </div>
  );
}

function PendingRequests({ data, format }: { data: DashboardData; format: AgencyFormat }) {
  const t = useTranslations('agency.dashboard.pending');
  const now = useNow();

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {t('title')}
            {data.pendingCount > 0 && <Badge tone="warning">{data.pendingCount}</Badge>}
          </CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        {data.pendingCount > 0 && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/bookings?filter=pending">
              {t('viewAll')}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {data.pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-control border border-dashed border-border px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
              <CheckCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('emptyText')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.pending.map((booking) => {
              const urgent = now - new Date(booking.createdAt).getTime() > URGENT_AFTER_MS;
              return (
                <li
                  key={booking.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center"
                >
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="group grid min-w-0 flex-1 gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CustomerIdentity customer={booking.customer} />
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-12 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {booking.vehicle.brand} {booking.vehicle.model}
                      </span>
                      <span className="tabular-nums">
                        {format.dayMonth(booking.pickupAt)} – {format.dayMonth(booking.returnAt)}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {format.money(booking.totalMillimes)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs',
                          urgent && 'font-medium text-danger',
                        )}
                      >
                        <Clock className="size-3.5" aria-hidden="true" />
                        {t('received', { time: format.relative(booking.createdAt) })}
                      </span>
                    </span>
                  </Link>
                  <BookingActionsBar booking={booking} size="sm" className="ps-12 md:ps-0" />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgendaList({
  bookings,
  kind,
  format,
}: {
  bookings: BookingView[];
  kind: 'departures' | 'returns';
  format: AgencyFormat;
}) {
  const t = useTranslations('agency.dashboard.today');
  if (bookings.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t(kind === 'departures' ? 'noDepartures' : 'noReturns')}
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {bookings.map((booking) => {
        const at = kind === 'departures' ? booking.pickupAt : booking.returnAt;
        const done =
          kind === 'departures' ? booking.status !== 'CONFIRMED' : booking.status !== 'PICKED_UP';
        return (
          <li key={booking.id}>
            <Link
              href={`/bookings/${booking.id}`}
              className={cn(
                'flex items-center gap-3 rounded-control border border-border p-3 transition-colors hover:bg-surface-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                done && 'opacity-60',
              )}
            >
              <span className="grid w-12 shrink-0 justify-items-center rounded-control bg-primary-soft py-1.5 text-primary-soft-foreground">
                <span className="text-sm font-bold tabular-nums">{format.time(at)}</span>
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium">
                  {customerName(booking.customer)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {booking.vehicle.brand} {booking.vehicle.model}
                  {booking.vehicle.plateNumber !== null && ` · ${booking.vehicle.plateNumber}`}
                </span>
              </span>
              <BookingStatusTag status={booking.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TodayCard({ data, format }: { data: DashboardData; format: AgencyFormat }) {
  const t = useTranslations('agency.dashboard.today');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription className="first-letter:uppercase">
          {format.weekdayDate(new Date())}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="departures">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="departures">
              <KeyRound className="size-4" aria-hidden="true" />
              {t('departures')}
              <span className="tabular-nums text-muted-foreground">
                {data.departuresToday.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="returns">
              <Undo2 className="size-4" aria-hidden="true" />
              {t('returns')}
              <span className="tabular-nums text-muted-foreground">{data.returnsToday.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="departures">
            <AgendaList bookings={data.departuresToday} kind="departures" format={format} />
          </TabsContent>
          <TabsContent value="returns">
            <AgendaList bookings={data.returnsToday} kind="returns" format={format} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ data, format }: { data: DashboardData; format: AgencyFormat }) {
  const t = useTranslations('agency.dashboard.revenue');
  const max = Math.max(1, ...data.revenueByMonth.map((entry) => entry.amountMillimes));
  const total = data.revenueByMonth.reduce((sum, entry) => sum + entry.amountMillimes, 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
        <div className="grid gap-1">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t('total')}</p>
          <p className="font-heading text-lg font-bold tabular-nums">{format.money(total)}</p>
        </div>
      </CardHeader>
      <CardContent>
        <figure>
          <figcaption className="sr-only">{t('title')}</figcaption>
          <ol className="flex h-56 items-end gap-2 sm:gap-4">
            {data.revenueByMonth.map((entry, index) => {
              const current = index === data.revenueByMonth.length - 1;
              const ratio = entry.amountMillimes / max;
              const date = `${entry.month}-15T12:00:00Z`;
              return (
                <li
                  key={entry.month}
                  className="group flex h-full flex-1 flex-col justify-end gap-2"
                >
                  <span
                    className={cn(
                      'text-center text-[0.6875rem] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:text-xs',
                      current && 'text-primary opacity-100',
                    )}
                  >
                    {format.integer(Math.round(entry.amountMillimes / 1000))}
                  </span>
                  <span
                    className={cn(
                      'block w-full rounded-t-control transition-colors',
                      current
                        ? 'bg-primary'
                        : 'bg-primary/25 group-hover:bg-primary/40 dark:bg-primary/30',
                    )}
                    style={{ height: `${String(Math.max(ratio * 100, 2))}%` }}
                  >
                    <span className="sr-only">
                      {t('barLabel', {
                        month: format.monthLong(date),
                        amount: format.money(entry.amountMillimes),
                      })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-center text-xs capitalize text-muted-foreground',
                      current && 'font-semibold text-foreground',
                    )}
                    aria-hidden="true"
                  >
                    {format.monthShort(date)}
                  </span>
                </li>
              );
            })}
          </ol>
        </figure>
        <p className="mt-3 text-xs text-muted-foreground">{t('unit')}</p>
      </CardContent>
    </Card>
  );
}

const FLEET_SEGMENTS: readonly { key: keyof FleetBreakdown; className: string }[] = [
  { key: 'available', className: 'bg-success' },
  { key: 'onRent', className: 'bg-violet-500' },
  { key: 'maintenance', className: 'bg-warning' },
  { key: 'inactive', className: 'bg-muted-foreground/40' },
];

function FleetCard({ data, format }: { data: DashboardData; format: AgencyFormat }) {
  const t = useTranslations('agency.dashboard.fleet');
  const total = FLEET_SEGMENTS.reduce((sum, { key }) => sum + data.fleet[key], 0);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle', { count: total })}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          {FLEET_SEGMENTS.map(({ key, className }) =>
            data.fleet[key] > 0 ? (
              <span
                key={key}
                className={cn('h-full', className)}
                style={{ width: `${String((data.fleet[key] / Math.max(total, 1)) * 100)}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {FLEET_SEGMENTS.map(({ key, className }) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className={cn('size-2.5 rounded-full', className)} aria-hidden="true" />
              <span className="flex-1 text-muted-foreground">{t(key)}</span>
              <span className="font-semibold tabular-nums">{format.integer(data.fleet[key])}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted/60 p-3">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">{t('rating')}</span>
            <span className="flex items-center gap-2">
              <span className="font-heading text-lg font-bold tabular-nums">
                {format.decimal(data.rating.average)}
              </span>
              <Rating
                value={data.rating.average}
                label={t('ratingLabel', { value: format.decimal(data.rating.average) })}
              />
            </span>
          </div>
          <Button asChild variant="link" size="sm">
            <Link href="/reviews">{t('reviewsCount', { count: data.rating.count })}</Link>
          </Button>
        </div>
        <Button asChild variant="secondary">
          <Link href="/fleet">
            <CarFront aria-hidden="true" />
            {t('manage')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <StatCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-card lg:col-span-2" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    </div>
  );
}

export function DashboardView({ firstName }: { firstName: string }) {
  const t = useTranslations('agency.dashboard');
  const tAuth = useTranslations('auth');
  const format = useAgencyFormat();
  const { data, isPending, isError, error, refetch, isFetching } = useDashboard();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={tAuth('greeting', { name: firstName })}
        title={t('title')}
        description={t('subtitle')}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/calendar">
                <CalendarDays aria-hidden="true" />
                {t('openPlanning')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/bookings">
                <CalendarCheck aria-hidden="true" />
                {t('openBookings')}
              </Link>
            </Button>
          </>
        }
      />

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <>
          <Kpis data={data} format={format} />
          <div className="grid gap-6 lg:grid-cols-3">
            <PendingRequests data={data} format={format} />
            <TodayCard data={data} format={format} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <RevenueChart data={data} format={format} />
            <FleetCard data={data} format={format} />
          </div>
          <section aria-label={t('quickLinks')} className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { href: '/fleet', icon: CarFront, key: 'fleet' },
                { href: '/payments', icon: Wallet, key: 'payments' },
                { href: '/settings', icon: Settings, key: 'settings' },
              ] as const
            ).map(({ href, icon: Icon, key }) => (
              <Link
                key={key}
                href={href}
                className="group flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-soft transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 items-center justify-center rounded-control bg-primary-soft text-primary-soft-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="grid flex-1">
                  <span className="text-sm font-semibold">{t(`shortcuts.${key}.title`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`shortcuts.${key}.text`)}
                  </span>
                </span>
                <ArrowRight
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

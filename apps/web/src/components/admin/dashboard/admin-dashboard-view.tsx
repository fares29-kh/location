'use client';

import type { BookingStatus } from '@drivetn/types';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import { Skeleton } from '@drivetn/ui/skeleton';
import { StatCard } from '@drivetn/ui/stat-card';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCheck,
  CircleDollarSign,
  FileWarning,
  ScrollText,
  UsersRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/agency/page-header';
import { QueryError, StatCardsSkeleton } from '@/components/agency/query-states';
import { type AgencyFormat, useAgencyFormat } from '@/components/agency/use-agency-format';
import { Link } from '@/i18n/navigation';
import { useAdminDashboard } from '@/lib/admin/queries';
import type { AdminDashboard } from '@/lib/admin/types';

import { ActivityList } from '../activity';
import { Identity, personName } from '../person';

function variation(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

function Kpis({ data, format }: { data: AdminDashboard; format: AgencyFormat }) {
  const t = useTranslations('admin.dashboard.kpis');
  const { kpis } = data;
  const gmvTrend = variation(kpis.gmvMonthMillimes, kpis.gmvPreviousMonthMillimes);
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
        label={t('gmv')}
        value={format.money(kpis.gmvMonthMillimes)}
        icon={CircleDollarSign}
        trend={trendText(gmvTrend)}
        trendDirection={direction(gmvTrend)}
      />
      <StatCard
        label={t('bookings')}
        value={format.integer(kpis.bookingsMonth)}
        icon={CalendarCheck}
        trend={trendText(bookingsTrend)}
        trendDirection={direction(bookingsTrend)}
      />
      <StatCard
        label={t('agencies')}
        value={format.integer(kpis.activeAgencies)}
        icon={Building2}
        trend={t('newThisMonth', { count: kpis.newAgenciesMonth })}
        trendDirection={kpis.newAgenciesMonth > 0 ? 'up' : 'neutral'}
      />
      <StatCard
        label={t('customers')}
        value={format.integer(kpis.customers)}
        icon={UsersRound}
        trend={t('newThisMonth', { count: kpis.newCustomersMonth })}
        trendDirection={kpis.newCustomersMonth > 0 ? 'up' : 'neutral'}
      />
    </div>
  );
}

function PendingAgencies({ data, format }: { data: AdminDashboard; format: AgencyFormat }) {
  const t = useTranslations('admin.dashboard.pending');
  const count = data.pendingAgencies.length;
  const shown = data.pendingAgencies.slice(0, 4);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {t('title')}
            {count > 0 && <Badge tone="warning">{count}</Badge>}
          </CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        {count > 0 && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/agencies?filter=pending">
              {t('viewAll')}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-control border border-dashed border-border px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
              <CheckCheck className="size-6" aria-hidden="true" />
            </span>
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('emptyText')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((agency) => {
              const missing = agency.documents.filter((doc) => doc.uploadedAt === null).length;
              return (
                <li key={agency.id}>
                  <Link
                    href={`/agencies?filter=pending&agency=${agency.id}`}
                    className="group flex flex-wrap items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-nowrap"
                  >
                    <Identity
                      name={agency.name}
                      secondary={`${agency.city} · ${personName(agency.owner)}`}
                      square
                      className="flex-1"
                    />
                    <span className="flex items-center gap-3 ps-12 sm:ps-0">
                      {missing > 0 ? (
                        <Badge tone="danger">
                          <FileWarning aria-hidden="true" />
                          {t('missingDocuments', { count: missing })}
                        </Badge>
                      ) : (
                        <Badge tone="success">{t('documentsComplete')}</Badge>
                      )}
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {format.relative(agency.createdAt)}
                      </span>
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BillingCard({ data, format }: { data: AdminDashboard; format: AgencyFormat }) {
  const t = useTranslations('admin.dashboard.billing');
  const { billing } = data;
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1 rounded-control bg-primary-soft p-4 text-primary-soft-foreground">
          <span className="text-xs font-medium">{t('mrr')}</span>
          <span className="font-heading text-2xl font-bold tabular-nums">
            {format.money(billing.mrrMillimes)}
          </span>
          <span className="text-xs opacity-80">{t('mrrHint')}</span>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('outstanding')}</dt>
            <dd className="font-semibold tabular-nums">
              {format.money(billing.outstandingMillimes)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('overdue')}</dt>
            <dd>
              {billing.overdueInvoices > 0 ? (
                <Badge tone="danger">
                  <AlertTriangle aria-hidden="true" />
                  {t('overdueCount', { count: billing.overdueInvoices })}
                </Badge>
              ) : (
                <Badge tone="success">{t('upToDate')}</Badge>
              )}
            </dd>
          </div>
        </dl>
        <Button asChild variant="secondary">
          <Link href={billing.overdueInvoices > 0 ? '/billing?filter=overdue' : '/billing'}>
            {t('open')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function GmvChart({ data, format }: { data: AdminDashboard; format: AgencyFormat }) {
  const t = useTranslations('admin.dashboard.gmv');
  const max = Math.max(1, ...data.gmvByMonth.map((entry) => entry.amountMillimes));
  const total = data.gmvByMonth.reduce((sum, entry) => sum + entry.amountMillimes, 0);

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
            {data.gmvByMonth.map((entry, index) => {
              const current = index === data.gmvByMonth.length - 1;
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
                    style={{
                      height: `${String(Math.max((entry.amountMillimes / max) * 100, 2))}%`,
                    }}
                  >
                    <span className="sr-only">
                      {t('barLabel', {
                        month: format.monthLong(date),
                        amount: format.money(entry.amountMillimes),
                        count: entry.bookings,
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

const STATUS_COLORS: Partial<Record<BookingStatus, string>> = {
  PENDING: 'bg-warning',
  CONFIRMED: 'bg-info',
  PICKED_UP: 'bg-violet-500',
  RETURNED: 'bg-violet-300',
  COMPLETED: 'bg-success',
};

function BookingStatusCard({ data, format }: { data: AdminDashboard; format: AgencyFormat }) {
  const t = useTranslations('admin.dashboard.status');
  const tStatus = useTranslations('status.booking');
  const total = data.bookingStatus.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle', { count: total })}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          {data.bookingStatus.map((entry) => (
            <span
              key={entry.status}
              className={cn('h-full', STATUS_COLORS[entry.status] ?? 'bg-muted-foreground/40')}
              style={{ width: `${String((entry.count / Math.max(total, 1)) * 100)}%` }}
            />
          ))}
        </div>
        <ul className="grid gap-2.5">
          {data.bookingStatus.map((entry) => (
            <li key={entry.status} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'size-2.5 rounded-full',
                  STATUS_COLORS[entry.status] ?? 'bg-muted-foreground/40',
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-muted-foreground">{tStatus(entry.status)}</span>
              <span className="font-semibold tabular-nums">{format.integer(entry.count)}</span>
              <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">
                {format.percent(entry.count / Math.max(total, 1))}
              </span>
            </li>
          ))}
        </ul>
        <Button asChild variant="secondary">
          <Link href="/bookings">{t('open')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function TopAgencies({ data, format }: { data: AdminDashboard; format: AgencyFormat }) {
  const t = useTranslations('admin.dashboard.top');
  const max = Math.max(1, ...data.topAgencies.map((entry) => entry.gmvMillimes));
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.topAgencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ol className="grid gap-4">
            {data.topAgencies.map((entry, index) => (
              <li key={entry.agency.id} className="grid gap-1.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-center font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <Link
                    href={`/agencies?agency=${entry.agency.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {entry.agency.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {t('bookings', { count: entry.bookings })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {format.money(entry.gmvMillimes)}
                  </span>
                </div>
                <div
                  className="ms-7 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${String((entry.gmvMillimes / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data }: { data: AdminDashboard }) {
  const t = useTranslations('admin.dashboard.activity');
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
        <div className="grid gap-1">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/audit">
            <ScrollText aria-hidden="true" />
            {t('viewAll')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ActivityList entries={data.recentActivity} empty={t('empty')} />
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

export function AdminDashboardView({ firstName }: { firstName: string }) {
  const t = useTranslations('admin.dashboard');
  const tAuth = useTranslations('auth');
  const format = useAgencyFormat();
  const { data, isPending, isError, error, refetch, isFetching } = useAdminDashboard();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={tAuth('greeting', { name: firstName })}
        title={t('title')}
        description={t('subtitle')}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/audit">
                <ScrollText aria-hidden="true" />
                {t('openAudit')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/agencies">
                <Building2 aria-hidden="true" />
                {t('openAgencies')}
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
            <PendingAgencies data={data} format={format} />
            <BillingCard data={data} format={format} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <GmvChart data={data} format={format} />
            <BookingStatusCard data={data} format={format} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <TopAgencies data={data} format={format} />
            <RecentActivity data={data} />
          </div>
        </>
      )}
    </div>
  );
}

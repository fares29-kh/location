'use client';

import { Alert } from '@drivetn/ui/alert';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { CalendarSearch, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { FilterTabs } from '@/components/agency/filter-tabs';
import { PageHeader } from '@/components/agency/page-header';
import { PaginationBar } from '@/components/agency/pagination-bar';
import { QueryError, TableSkeleton } from '@/components/agency/query-states';
import { SearchField } from '@/components/agency/search-field';
import { BookingStatusTag, PaymentStatusTag } from '@/components/agency/status-tags';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useNow } from '@/components/agency/use-now';
import { useUrlState } from '@/components/agency/use-url-state';
import { displayPhone } from '@/components/auth/otp-step';
import { Link } from '@/i18n/navigation';
import { usePlatformBookings, usePlatformSettings } from '@/lib/admin/queries';
import type { BookingFilter, PlatformBooking } from '@/lib/admin/types';

import { personName } from '../person';

const FILTERS: readonly BookingFilter[] = ['all', 'pending', 'active', 'completed', 'cancelled'];
const URL_DEFAULTS = { q: '', filter: 'all', page: '1' };
const HOUR_MS = 3_600_000;

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  if (key === 'filter') {
    return (FILTERS as readonly string[]).includes(value);
  }
  return key !== 'page' || /^\d+$/.test(value);
}

function useIsStale() {
  const now = useNow();
  const { data: settings } = usePlatformSettings();
  const limit = (settings?.bookingExpiryHours ?? 24) * HOUR_MS;
  return (booking: PlatformBooking) =>
    booking.status === 'PENDING' && now - Date.parse(booking.createdAt) > limit;
}

function StaleBadge() {
  const t = useTranslations('admin.bookings');
  return (
    <Badge tone="danger">
      <Clock aria-hidden="true" />
      {t('stale')}
    </Badge>
  );
}

function BookingsTable({ bookings }: { bookings: PlatformBooking[] }) {
  const t = useTranslations('admin.bookings');
  const format = useAgencyFormat();
  const isStale = useIsStale();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.reference')}</TableHead>
          <TableHead>{t('columns.customer')}</TableHead>
          <TableHead>{t('columns.agency')}</TableHead>
          <TableHead>{t('columns.dates')}</TableHead>
          <TableHead className="text-end">{t('columns.total')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id}>
            <TableCell>
              <span className="grid gap-0.5">
                <span className="font-mono text-xs font-medium">{booking.reference}</span>
                <span className="text-xs text-muted-foreground">
                  {format.relative(booking.createdAt)}
                </span>
              </span>
            </TableCell>
            <TableCell>
              <span className="grid">
                <span className="text-sm font-medium">{personName(booking.customer)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {displayPhone(booking.customer.phone)}
                </span>
              </span>
            </TableCell>
            <TableCell>
              <span className="grid">
                <Link
                  href={`/agencies?agency=${booking.agency.id}`}
                  className="w-fit text-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {booking.agency.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {booking.vehicle.brand} {booking.vehicle.model}
                </span>
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap text-sm tabular-nums">
              {format.dayMonth(booking.pickupAt)} – {format.date(booking.returnAt)}
              <span className="block text-xs text-muted-foreground">{booking.pickupLocation}</span>
            </TableCell>
            <TableCell className="text-end font-semibold tabular-nums">
              {format.money(booking.totalMillimes)}
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1.5">
                <BookingStatusTag status={booking.status} />
                {isStale(booking) ? (
                  <StaleBadge />
                ) : (
                  <PaymentStatusTag status={booking.paymentStatus} />
                )}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BookingCards({ bookings }: { bookings: PlatformBooking[] }) {
  const format = useAgencyFormat();
  const isStale = useIsStale();
  return (
    <ul className="grid gap-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Card className="grid gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{personName(booking.customer)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {booking.agency.name} · {booking.vehicle.brand} {booking.vehicle.model}
                </span>
              </span>
              <BookingStatusTag status={booking.status} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="tabular-nums text-muted-foreground">
                {format.dayMonth(booking.pickupAt)} – {format.dayMonth(booking.returnAt)} ·{' '}
                <span className="font-mono text-xs">{booking.reference}</span>
              </span>
              {isStale(booking) && <StaleBadge />}
              <span className="font-semibold tabular-nums">
                {format.money(booking.totalMillimes)}
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function PlatformBookingsView() {
  const t = useTranslations('admin.bookings');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const filter = params.filter as BookingFilter;
  const query = { search: params.q, filter, page: Number(params.page) };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    usePlatformBookings(query);
  const { data: settings } = usePlatformSettings();

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );
  const filtered = query.search.length > 0 || filter !== 'all';

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={data === undefined ? t('subtitle') : t('summary', { count: data.counts.all })}
      />

      {data !== undefined && data.stalePending > 0 && (
        <Alert
          tone="warning"
          title={t('staleTitle', { count: data.stalePending })}
          action={
            filter === 'pending' ? undefined : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setParams({ filter: 'pending', page: '1' });
                }}
              >
                {t('showPending')}
              </Button>
            )
          }
        >
          {t('staleText', { hours: settings?.bookingExpiryHours ?? 24 })}
        </Alert>
      )}

      <div className="grid gap-4">
        <SearchField
          value={params.q}
          onValueChange={onSearch}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
        />
        <FilterTabs
          label={t('filterLabel')}
          value={filter}
          onValueChange={(value) => {
            setParams({ filter: value, page: '1' });
          }}
          options={FILTERS.map((value) => ({
            value,
            label: t(`filters.${value}`),
            count: data?.counts[value],
          }))}
        />
      </div>

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={CalendarSearch}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setParams({ q: '', filter: 'all', page: '1' });
                }}
              >
                {t('clearFilters')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          className={cn('grid gap-4 transition-opacity', isPlaceholderData && 'opacity-60')}
          aria-busy={isPlaceholderData}
        >
          <div className="hidden lg:block">
            <BookingsTable bookings={data.items} />
          </div>
          <div className="lg:hidden">
            <BookingCards bookings={data.items} />
          </div>
          <PaginationBar
            data={data}
            onPageChange={(page) => {
              setParams({ page: String(page) });
            }}
          />
        </div>
      )}
    </div>
  );
}

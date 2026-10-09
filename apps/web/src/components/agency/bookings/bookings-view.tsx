'use client';

import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { CalendarSearch, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { Link } from '@/i18n/navigation';
import { useBookings } from '@/lib/agency/queries';
import {
  BOOKING_FILTERS,
  BOOKING_SORTS,
  type BookingFilter,
  type BookingSort,
  type BookingView,
} from '@/lib/agency/types';

import { FilterTabs } from '../filter-tabs';
import { PageHeader } from '../page-header';
import { PaginationBar } from '../pagination-bar';
import { CustomerIdentity } from '../people';
import { QueryError, TableSkeleton } from '../query-states';
import { SearchField } from '../search-field';
import { BookingStatusTag, PaymentStatusTag } from '../status-tags';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';
import { vehicleCoverUrl } from '@/lib/agency/vehicle-photos';

import { VehicleThumb } from '../vehicle-thumb';

const URL_DEFAULTS = { filter: 'all', q: '', sort: 'pickup_desc', page: '1' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  switch (key) {
    case 'filter':
      return (BOOKING_FILTERS as readonly string[]).includes(value);
    case 'sort':
      return (BOOKING_SORTS as readonly string[]).includes(value);
    case 'page':
      return /^\d+$/.test(value);
    case 'q':
      return true;
  }
}

function BookingDates({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookings');
  const format = useAgencyFormat();
  return (
    <span className="grid gap-0.5">
      <span className="whitespace-nowrap font-medium tabular-nums">
        {format.dayMonth(booking.pickupAt)} – {format.dayMonth(booking.returnAt)}
      </span>
      <span className="text-xs text-muted-foreground">
        {t('days', { count: booking.days })} · {format.time(booking.pickupAt)}
      </span>
    </span>
  );
}

function BookingsTable({ bookings }: { bookings: BookingView[] }) {
  const t = useTranslations('agency.bookings');
  const format = useAgencyFormat();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.customer')}</TableHead>
          <TableHead>{t('columns.vehicle')}</TableHead>
          <TableHead>{t('columns.dates')}</TableHead>
          <TableHead className="text-end">{t('columns.amount')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">{t('columns.open')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id} className="group relative">
            <TableCell>
              <Link
                href={`/bookings/${booking.id}`}
                className="grid gap-1 focus-visible:outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
              >
                <CustomerIdentity customer={booking.customer} showPhone={false} />
                <span className="ps-12 font-mono text-xs text-muted-foreground">
                  {booking.reference}
                </span>
              </Link>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-3">
                <VehicleThumb
                  color={booking.vehicle.color}
                  photoUrl={vehicleCoverUrl(booking.vehicle)}
                />
                <span className="grid">
                  <span className="whitespace-nowrap font-medium">
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </span>
                  {booking.vehicle.plateNumber !== null && (
                    <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {booking.vehicle.plateNumber}
                    </span>
                  )}
                </span>
              </span>
            </TableCell>
            <TableCell>
              <BookingDates booking={booking} />
            </TableCell>
            <TableCell className="text-end">
              <span className="grid justify-items-end gap-1">
                <span className="whitespace-nowrap font-semibold tabular-nums">
                  {format.money(booking.totalMillimes)}
                </span>
                <PaymentStatusTag status={booking.payment.status} />
              </span>
            </TableCell>
            <TableCell>
              <BookingStatusTag status={booking.status} />
            </TableCell>
            <TableCell>
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BookingCards({ bookings }: { bookings: BookingView[] }) {
  const format = useAgencyFormat();
  return (
    <ul className="grid gap-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Card className="relative grid gap-3 p-4 transition-shadow hover:shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/bookings/${booking.id}`}
                className="min-w-0 focus-visible:outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                <CustomerIdentity customer={booking.customer} showPhone={false} />
              </Link>
              <BookingStatusTag status={booking.status} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">
                {booking.vehicle.brand} {booking.vehicle.model} ·{' '}
                <span className="font-mono text-xs">{booking.reference}</span>
              </span>
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-border pt-3 text-sm">
              <BookingDates booking={booking} />
              <span className="grid justify-items-end gap-1">
                <span className="font-semibold tabular-nums">
                  {format.money(booking.totalMillimes)}
                </span>
                <PaymentStatusTag status={booking.payment.status} />
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function BookingsView() {
  const t = useTranslations('agency.bookings');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const query = {
    filter: params.filter as BookingFilter,
    search: params.q,
    sort: params.sort as BookingSort,
    page: Number(params.page),
  };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useBookings(query);

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );

  const hasFilters = query.filter !== 'all' || query.search.length > 0;

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            value={params.q}
            onValueChange={onSearch}
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
          />
          <Select
            value={query.sort}
            onValueChange={(sort) => {
              setParams({ sort, page: '1' });
            }}
          >
            <SelectTrigger className="sm:w-56" aria-label={t('sortLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {t(`sorts.${sort}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FilterTabs
          label={t('filterLabel')}
          value={query.filter}
          onValueChange={(filter) => {
            setParams({ filter, page: '1' });
          }}
          options={BOOKING_FILTERS.map((filter) => ({
            value: filter,
            label: t(`filters.${filter}`),
            count: data?.counts[filter],
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
          title={hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}
          description={hasFilters ? t('emptyFilteredText') : t('emptyText')}
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setParams({ filter: 'all', q: '', page: '1' });
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
          <div className="hidden md:block">
            <BookingsTable bookings={data.items} />
          </div>
          <div className="md:hidden">
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

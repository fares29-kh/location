'use client';

import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { ChevronRight, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { useCustomers } from '@/lib/agency/queries';
import type { CustomerView } from '@/lib/agency/types';

import { PageHeader } from '../page-header';
import { PaginationBar } from '../pagination-bar';
import { ContactActions, CustomerIdentity } from '../people';
import { QueryError, TableSkeleton } from '../query-states';
import { SearchField } from '../search-field';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';
import { CustomerSheet } from './customer-sheet';

const URL_DEFAULTS = { q: '', page: '1', customer: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  return key !== 'page' || /^\d+$/.test(value);
}

/** Client fidèle : au moins trois locations menées à terme. */
const LOYAL_THRESHOLD = 3;

function LoyaltyBadge({ customer }: { customer: CustomerView }) {
  const t = useTranslations('agency.customers');
  if (customer.completedCount >= LOYAL_THRESHOLD) {
    return <Badge tone="success">{t('badges.loyal')}</Badge>;
  }
  if (customer.bookingsCount <= 1) {
    return <Badge tone="info">{t('badges.new')}</Badge>;
  }
  return null;
}

function OpenButton({
  customer,
  onOpen,
  className,
}: {
  customer: CustomerView;
  onOpen: (id: string) => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(customer.id);
      }}
      className={cn(
        'min-w-0 text-start focus-visible:outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring',
        className,
      )}
    >
      <CustomerIdentity customer={customer} />
    </button>
  );
}

function CustomersTable({
  customers,
  onOpen,
}: {
  customers: CustomerView[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('agency.customers');
  const format = useAgencyFormat();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.customer')}</TableHead>
          <TableHead>{t('columns.city')}</TableHead>
          <TableHead className="text-end">{t('columns.bookings')}</TableHead>
          <TableHead className="text-end">{t('columns.spent')}</TableHead>
          <TableHead>{t('columns.lastBooking')}</TableHead>
          <TableHead>
            <span className="sr-only">{t('columns.contact')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id} className="group relative">
            <TableCell>
              <span className="flex items-center gap-2">
                <OpenButton customer={customer} onOpen={onOpen} className="after:rounded-sm" />
                <LoyaltyBadge customer={customer} />
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">{customer.city}</TableCell>
            <TableCell className="text-end tabular-nums">
              {format.integer(customer.bookingsCount)}
            </TableCell>
            <TableCell className="text-end font-semibold tabular-nums">
              {format.money(customer.totalSpentMillimes)}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {customer.lastBookingAt === null ? '—' : format.date(customer.lastBookingAt)}
            </TableCell>
            <TableCell>
              <span className="relative z-10 flex items-center justify-end gap-2">
                <ContactActions phone={customer.phone} compact />
                <ChevronRight
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CustomerCards({
  customers,
  onOpen,
}: {
  customers: CustomerView[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('agency.customers');
  const format = useAgencyFormat();
  return (
    <ul className="grid gap-3">
      {customers.map((customer) => (
        <li key={customer.id}>
          <Card className="relative grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <OpenButton customer={customer} onOpen={onOpen} className="after:rounded-card" />
              <LoyaltyBadge customer={customer} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">
                {t('bookingsCount', { count: customer.bookingsCount })} · {customer.city}
              </span>
              <span className="font-semibold tabular-nums">
                {format.money(customer.totalSpentMillimes)}
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function CustomersView() {
  const t = useTranslations('agency.customers');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const query = { search: params.q, page: Number(params.page) };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useCustomers(query);

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );
  const openCustomer = useCallback(
    (customer: string) => {
      setParams({ customer });
    },
    [setParams],
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <PageHeader
        title={t('title')}
        description={data === undefined ? t('subtitle') : t('summary', { count: data.total })}
      />

      <SearchField
        value={params.q}
        onValueChange={onSearch}
        label={t('searchLabel')}
        placeholder={t('searchPlaceholder')}
      />

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={query.search.length > 0 ? t('emptyFilteredTitle') : t('emptyTitle')}
          description={query.search.length > 0 ? t('emptyFilteredText') : t('emptyText')}
          action={
            query.search.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setParams({ q: '', page: '1' });
                }}
              >
                {t('clearSearch')}
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
            <CustomersTable customers={data.items} onOpen={openCustomer} />
          </div>
          <div className="md:hidden">
            <CustomerCards customers={data.items} onOpen={openCustomer} />
          </div>
          <PaginationBar
            data={data}
            onPageChange={(page) => {
              setParams({ page: String(page) });
            }}
          />
        </div>
      )}

      <CustomerSheet
        customerId={params.customer.length > 0 ? params.customer : null}
        onClose={() => {
          setParams({ customer: '' });
        }}
      />
    </div>
  );
}

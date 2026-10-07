'use client';

import { SUBSCRIPTION_PLAN_DEFINITIONS } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { StatCard } from '@drivetn/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import {
  AlertTriangle,
  BellRing,
  CircleDollarSign,
  HandCoins,
  ReceiptText,
  Repeat,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { FilterTabs } from '@/components/agency/filter-tabs';
import { PageHeader } from '@/components/agency/page-header';
import { PaginationBar } from '@/components/agency/pagination-bar';
import { QueryError, StatCardsSkeleton, TableSkeleton } from '@/components/agency/query-states';
import { SearchField } from '@/components/agency/search-field';
import { type AgencyFormat, useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import { useInvoice, useInvoices } from '@/lib/admin/queries';
import type { BillingOverview, Invoice, InvoiceFilter } from '@/lib/admin/types';

import { InvoiceStatusTag, PlanTag } from '../status-tags';
import { InvoiceDialog } from './invoice-dialog';

const FILTERS: readonly InvoiceFilter[] = ['all', 'issued', 'overdue', 'paid'];
const URL_DEFAULTS = { q: '', filter: 'all', page: '1', invoice: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  if (key === 'filter') {
    return (FILTERS as readonly string[]).includes(value);
  }
  return key !== 'page' || /^\d+$/.test(value);
}

function Overview({ overview, format }: { overview: BillingOverview; format: AgencyFormat }) {
  const t = useTranslations('admin.billing.overview');
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('mrr')}
        value={format.money(overview.mrrMillimes)}
        icon={Repeat}
        trend={t('mrrHint')}
      />
      <StatCard
        label={t('collected')}
        value={format.money(overview.collectedMonthMillimes)}
        icon={HandCoins}
        trend={t('collectedHint')}
        trendDirection="up"
      />
      <StatCard
        label={t('outstanding')}
        value={format.money(overview.outstandingMillimes)}
        icon={CircleDollarSign}
        trend={t('outstandingHint')}
      />
      <StatCard
        label={t('overdue')}
        value={format.money(overview.overdueMillimes)}
        icon={AlertTriangle}
        trend={overview.overdueMillimes > 0 ? t('overdueHint') : t('noOverdue')}
        trendDirection={overview.overdueMillimes > 0 ? 'down' : 'up'}
      />
    </div>
  );
}

function Plans({ overview, format }: { overview: BillingOverview; format: AgencyFormat }) {
  const t = useTranslations('admin.billing.plans');
  return (
    <section aria-labelledby="billing-plans" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="billing-plans" className="font-heading text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {overview.plans.map(({ plan, agencies }) => {
          const definition = SUBSCRIPTION_PLAN_DEFINITIONS[plan];
          return (
            <li key={plan}>
              <Card className="grid gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <PlanTag plan={plan} />
                  <span className="text-sm text-muted-foreground">
                    {t('agencies', { count: agencies })}
                  </span>
                </div>
                <p className="font-heading text-xl font-bold tabular-nums">
                  {format.money(definition.monthlyPriceMillimes)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    {t('perMonth')}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {definition.vehicleLimit === null
                    ? t('unlimited')
                    : t('vehicleLimit', { count: definition.vehicleLimit })}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InvoicesTable({
  invoices,
  onOpen,
}: {
  invoices: Invoice[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('admin.billing');
  const format = useAgencyFormat();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.number')}</TableHead>
          <TableHead>{t('columns.agency')}</TableHead>
          <TableHead>{t('columns.period')}</TableHead>
          <TableHead className="text-end">{t('columns.total')}</TableHead>
          <TableHead>{t('columns.dueAt')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id} className="group relative">
            <TableCell>
              <button
                type="button"
                onClick={() => {
                  onOpen(invoice.id);
                }}
                className="font-mono text-xs font-medium text-primary after:absolute after:inset-0 after:rounded-sm hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
              >
                {invoice.number}
              </button>
            </TableCell>
            <TableCell>
              <span className="grid">
                <span className="text-sm font-medium">{invoice.agency.name}</span>
                <span className="text-xs text-muted-foreground">{invoice.agency.city}</span>
              </span>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2 text-sm capitalize">
                {format.monthLong(`${invoice.period}-15T12:00:00Z`)}
                <PlanTag plan={invoice.plan} />
              </span>
            </TableCell>
            <TableCell className="text-end font-semibold tabular-nums">
              {format.money(invoice.totalMillimes)}
            </TableCell>
            <TableCell
              className={cn(
                'tabular-nums',
                invoice.status === 'OVERDUE' ? 'text-danger' : 'text-muted-foreground',
              )}
            >
              {format.date(invoice.dueAt)}
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-1.5">
                <InvoiceStatusTag status={invoice.status} />
                {invoice.remindedAt !== null && invoice.status !== 'PAID' && (
                  <BellRing
                    className="size-3.5 text-muted-foreground"
                    role="img"
                    aria-label={t('reminded')}
                  />
                )}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InvoiceCards({ invoices, onOpen }: { invoices: Invoice[]; onOpen: (id: string) => void }) {
  const format = useAgencyFormat();
  return (
    <ul className="grid gap-3">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <Card className="relative grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  onOpen(invoice.id);
                }}
                className="grid min-w-0 gap-0.5 text-start after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                <span className="truncate font-medium">{invoice.agency.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{invoice.number}</span>
              </button>
              <InvoiceStatusTag status={invoice.status} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
              <span className="capitalize text-muted-foreground">
                {format.monthLong(`${invoice.period}-15T12:00:00Z`)}
              </span>
              <span className="font-semibold tabular-nums">
                {format.money(invoice.totalMillimes)}
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function BillingView() {
  const t = useTranslations('admin.billing');
  const format = useAgencyFormat();
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const filter = params.filter as InvoiceFilter;
  const query = { search: params.q, filter, page: Number(params.page) };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useInvoices(query);

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );
  const openInvoice = useCallback(
    (invoice: string) => {
      setParams({ invoice });
    },
    [setParams],
  );
  const listed = data?.items.find((invoice) => invoice.id === params.invoice);
  const { data: linked } = useInvoice(
    params.invoice !== '' && data !== undefined && listed === undefined ? params.invoice : null,
  );
  const selected = listed ?? linked ?? null;
  const filtered = query.search.length > 0 || filter !== 'all';

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      {data === undefined ? (
        isPending && <StatCardsSkeleton />
      ) : (
        <>
          <Overview overview={data.overview} format={format} />
          <Plans overview={data.overview} format={format} />
        </>
      )}

      <section aria-labelledby="billing-invoices" className="grid gap-4">
        <h2 id="billing-invoices" className="font-heading text-lg font-semibold">
          {t('invoicesTitle')}
        </h2>
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

        {isPending ? (
          <TableSkeleton />
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
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
              <InvoicesTable invoices={data.items} onOpen={openInvoice} />
            </div>
            <div className="lg:hidden">
              <InvoiceCards invoices={data.items} onOpen={openInvoice} />
            </div>
            <PaginationBar
              data={data}
              onPageChange={(page) => {
                setParams({ page: String(page) });
              }}
            />
          </div>
        )}
      </section>

      <InvoiceDialog
        invoice={selected}
        onClose={() => {
          setParams({ invoice: '' });
        }}
      />
    </div>
  );
}

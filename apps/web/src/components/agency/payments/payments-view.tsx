'use client';

import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  type PaymentKind,
  type PaymentMethod,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Badge, type BadgeTone } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { PAYMENT_METHOD_ICONS } from '@drivetn/ui/payment-method-badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { StatCard } from '@drivetn/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Hourglass,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { usePayments } from '@/lib/agency/queries';
import type { PaymentSummaryTotals, PaymentView } from '@/lib/agency/types';

import { PageHeader } from '../page-header';
import { PaginationBar } from '../pagination-bar';
import { QueryError, StatCardsSkeleton, TableSkeleton } from '../query-states';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';

const URL_DEFAULTS = { kind: 'ALL', method: 'ALL', page: '1' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  switch (key) {
    case 'kind':
      return value === 'ALL' || (PAYMENT_KINDS as readonly string[]).includes(value);
    case 'method':
      return value === 'ALL' || (PAYMENT_METHODS as readonly string[]).includes(value);
    case 'page':
      return /^\d+$/.test(value);
  }
}

const KIND_TONES: Record<PaymentKind, BadgeTone> = {
  RENTAL: 'success',
  REFUND: 'danger',
  DEPOSIT_HELD: 'info',
  DEPOSIT_RETURNED: 'neutral',
};

/** Les remboursements et cautions rendues sortent de la caisse. */
function isOutgoing(kind: PaymentKind): boolean {
  return kind === 'REFUND' || kind === 'DEPOSIT_RETURNED';
}

function SignedAmount({ payment }: { payment: PaymentView }) {
  const format = useAgencyFormat();
  const outgoing = isOutgoing(payment.kind);
  return (
    <span
      className={cn(
        'whitespace-nowrap font-semibold tabular-nums',
        outgoing ? 'text-danger' : 'text-foreground',
      )}
      dir="ltr"
    >
      {outgoing ? '−' : '+'}
      {format.money(payment.amountMillimes)}
    </span>
  );
}

function MethodLabel({ method }: { method: PaymentMethod }) {
  const tMethod = useTranslations('status.paymentMethod');
  const Icon = PAYMENT_METHOD_ICONS[method];
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      {tMethod(method)}
    </span>
  );
}

function Summary({ summary }: { summary: PaymentSummaryTotals }) {
  const t = useTranslations('agency.payments.page');
  const format = useAgencyFormat();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('kpis.collected')}
        value={format.money(summary.collectedMonthMillimes)}
        icon={Wallet}
        trend={t('kpis.thisMonth')}
        trendDirection="neutral"
      />
      <StatCard
        label={t('kpis.refunded')}
        value={format.money(summary.refundedMonthMillimes)}
        icon={ArrowUpRight}
        trend={t('kpis.thisMonth')}
        trendDirection="neutral"
      />
      <StatCard
        label={t('kpis.outstanding')}
        value={format.money(summary.outstandingMillimes)}
        icon={Hourglass}
        trend={t('kpis.outstandingHint')}
        trendDirection={summary.outstandingMillimes > 0 ? 'down' : 'neutral'}
      />
      <StatCard
        label={t('kpis.deposits')}
        value={format.money(summary.depositsHeldMillimes)}
        icon={ShieldCheck}
        trend={t('kpis.depositsHint')}
        trendDirection="neutral"
      />
    </div>
  );
}

function MethodBreakdown({ summary }: { summary: PaymentSummaryTotals }) {
  const t = useTranslations('agency.payments.page');
  const format = useAgencyFormat();
  const rows = PAYMENT_METHODS.map((method) => ({ method, amount: summary.byMethod[method] }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('byMethod.title')}</CardTitle>
        <CardDescription>{t('byMethod.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('byMethod.empty')}</p>
        ) : (
          <ul className="grid gap-4">
            {rows.map(({ method, amount }) => (
              <li key={method} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <MethodLabel method={method} />
                  <span className="font-medium tabular-nums">{format.money(amount)}</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(2, Math.round((amount / total) * 100))}%` }}
                  />
                </div>
                <span className="sr-only">{format.percent(amount / total)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsTable({ payments }: { payments: PaymentView[] }) {
  const t = useTranslations('agency.payments');
  const format = useAgencyFormat();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('page.columns.date')}</TableHead>
          <TableHead>{t('page.columns.booking')}</TableHead>
          <TableHead>{t('page.columns.kind')}</TableHead>
          <TableHead>{t('page.columns.method')}</TableHead>
          <TableHead className="text-end">{t('page.columns.amount')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
              {format.shortDateTime(payment.recordedAt)}
            </TableCell>
            <TableCell>
              <Link
                href={`/bookings/${payment.bookingId}`}
                className="grid rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{payment.customerName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {payment.bookingReference}
                </span>
              </Link>
            </TableCell>
            <TableCell>
              <Badge tone={KIND_TONES[payment.kind]}>{t(`kinds.${payment.kind}`)}</Badge>
              {payment.note !== null && (
                <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground">
                  {payment.note}
                </p>
              )}
            </TableCell>
            <TableCell>
              <MethodLabel method={payment.method} />
            </TableCell>
            <TableCell className="text-end">
              <SignedAmount payment={payment} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PaymentCards({ payments }: { payments: PaymentView[] }) {
  const t = useTranslations('agency.payments');
  const format = useAgencyFormat();
  return (
    <ul className="grid gap-3">
      {payments.map((payment) => (
        <li key={payment.id}>
          <Card className="relative grid gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/bookings/${payment.bookingId}`}
                className="grid min-w-0 focus-visible:outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                <span className="truncate font-medium">{payment.customerName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {payment.bookingReference}
                </span>
              </Link>
              <SignedAmount payment={payment} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <Badge tone={KIND_TONES[payment.kind]}>{t(`kinds.${payment.kind}`)}</Badge>
              <span className="flex items-center gap-2">
                <MethodLabel method={payment.method} />
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{format.dayMonth(payment.recordedAt)}</span>
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function PaymentsView() {
  const t = useTranslations('agency.payments');
  const tMethod = useTranslations('status.paymentMethod');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const query = {
    kind: params.kind as PaymentKind | 'ALL',
    method: params.method as PaymentMethod | 'ALL',
    page: Number(params.page),
  };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    usePayments(query);
  const hasFilters = query.kind !== 'ALL' || query.method !== 'ALL';

  return (
    <div className="grid gap-6">
      <PageHeader title={t('page.title')} description={t('page.subtitle')} />

      <Alert tone="info" title={t('page.offlineTitle')}>
        {t('page.offlineText')}
      </Alert>

      {isPending ? (
        <>
          <StatCardsSkeleton />
          <TableSkeleton />
        </>
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <>
          <Summary summary={data.summary} />

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="grid gap-4" aria-labelledby="payments-journal">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="payments-journal" className="font-heading text-lg font-semibold">
                  {t('page.journal')}
                </h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={query.kind}
                    onValueChange={(kind) => {
                      setParams({ kind, page: '1' });
                    }}
                  >
                    <SelectTrigger className="sm:w-48" aria-label={t('page.kindFilter')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('page.allKinds')}</SelectItem>
                      {PAYMENT_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {t(`kinds.${kind}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={query.method}
                    onValueChange={(method) => {
                      setParams({ method, page: '1' });
                    }}
                  >
                    <SelectTrigger className="sm:w-48" aria-label={t('page.methodFilter')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('page.allMethods')}</SelectItem>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {tMethod(method)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {data.items.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title={hasFilters ? t('page.emptyFilteredTitle') : t('page.emptyTitle')}
                  description={hasFilters ? t('page.emptyFilteredText') : t('page.emptyText')}
                  action={
                    hasFilters ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setParams({ kind: 'ALL', method: 'ALL', page: '1' });
                        }}
                      >
                        {t('page.clearFilters')}
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
                    <PaymentsTable payments={data.items} />
                  </div>
                  <div className="md:hidden">
                    <PaymentCards payments={data.items} />
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

            <aside className="grid gap-4">
              <MethodBreakdown summary={data.summary} />
              <Card className="flex items-start gap-3 p-4 text-sm">
                <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-muted-foreground">
                  {t.rich('page.recordHint', {
                    link: (chunks) => (
                      <Link
                        href="/bookings?filter=ongoing"
                        className="font-medium text-primary hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              </Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

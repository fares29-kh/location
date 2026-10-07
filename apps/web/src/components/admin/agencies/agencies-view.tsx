'use client';

import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { Building2, ChevronRight, FileWarning, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { FilterTabs } from '@/components/agency/filter-tabs';
import { PageHeader } from '@/components/agency/page-header';
import { PaginationBar } from '@/components/agency/pagination-bar';
import { QueryError, TableSkeleton } from '@/components/agency/query-states';
import { SearchField } from '@/components/agency/search-field';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import { displayPhone } from '@/components/auth/otp-step';
import { useAgencies } from '@/lib/admin/queries';
import type { Agency, AgencyFilter } from '@/lib/admin/types';

import { Identity, personName } from '../person';
import { AgencyStatusTag, PlanTag } from '../status-tags';
import { AgencySheet } from './agency-sheet';

const FILTERS: readonly AgencyFilter[] = ['all', 'pending', 'active', 'suspended', 'rejected'];
const URL_DEFAULTS = { q: '', filter: 'all', page: '1', agency: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  if (key === 'filter') {
    return (FILTERS as readonly string[]).includes(value);
  }
  return key !== 'page' || /^\d+$/.test(value);
}

function OpenButton({
  agency,
  onOpen,
  className,
}: {
  agency: Agency;
  onOpen: (id: string) => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(agency.id);
      }}
      className={cn(
        'min-w-0 text-start focus-visible:outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring',
        className,
      )}
    >
      <Identity name={agency.name} secondary={agency.city} square />
    </button>
  );
}

function MissingDocuments({ agency }: { agency: Agency }) {
  const t = useTranslations('admin.agencies');
  const missing = agency.documents.filter((document) => document.uploadedAt === null).length;
  if (agency.status !== 'PENDING_REVIEW' || missing === 0) {
    return null;
  }
  return (
    <Badge tone="danger">
      <FileWarning aria-hidden="true" />
      {t('missingDocuments', { count: missing })}
    </Badge>
  );
}

function RatingCell({ agency }: { agency: Agency }) {
  const format = useAgencyFormat();
  if (agency.rating.count === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />
      {format.decimal(agency.rating.average)}
      <span className="text-xs text-muted-foreground">({format.integer(agency.rating.count)})</span>
    </span>
  );
}

function AgenciesTable({ agencies, onOpen }: { agencies: Agency[]; onOpen: (id: string) => void }) {
  const t = useTranslations('admin.agencies');
  const format = useAgencyFormat();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.agency')}</TableHead>
          <TableHead>{t('columns.owner')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
          <TableHead>{t('columns.plan')}</TableHead>
          <TableHead className="text-end">{t('columns.fleet')}</TableHead>
          <TableHead className="text-end">{t('columns.gmv')}</TableHead>
          <TableHead>{t('columns.rating')}</TableHead>
          <TableHead>
            <span className="sr-only">{t('columns.open')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agencies.map((agency) => (
          <TableRow key={agency.id} className="group relative">
            <TableCell>
              <OpenButton agency={agency} onOpen={onOpen} className="after:rounded-sm" />
            </TableCell>
            <TableCell>
              <span className="grid">
                <span className="text-sm">{personName(agency.owner)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {displayPhone(agency.owner.phone)}
                </span>
              </span>
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1.5">
                <AgencyStatusTag status={agency.status} />
                <MissingDocuments agency={agency} />
              </span>
            </TableCell>
            <TableCell>
              <PlanTag plan={agency.plan} />
            </TableCell>
            <TableCell className="text-end tabular-nums">
              {format.integer(agency.vehiclesCount)}
            </TableCell>
            <TableCell className="text-end font-semibold tabular-nums">
              {agency.status === 'PENDING_REVIEW' ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {t('submitted', { time: format.relative(agency.createdAt) })}
                </span>
              ) : (
                format.money(agency.gmvMonthMillimes)
              )}
            </TableCell>
            <TableCell>
              <RatingCell agency={agency} />
            </TableCell>
            <TableCell>
              <ChevronRight
                className="ms-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AgencyCards({ agencies, onOpen }: { agencies: Agency[]; onOpen: (id: string) => void }) {
  const t = useTranslations('admin.agencies');
  const format = useAgencyFormat();
  return (
    <ul className="grid gap-3">
      {agencies.map((agency) => (
        <li key={agency.id}>
          <Card className="relative grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <OpenButton agency={agency} onOpen={onOpen} className="after:rounded-card" />
              <AgencyStatusTag status={agency.status} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <PlanTag plan={agency.plan} />
                {t('vehiclesCount', { count: agency.vehiclesCount })}
              </span>
              <MissingDocuments agency={agency} />
              {agency.status !== 'PENDING_REVIEW' && (
                <span className="font-semibold tabular-nums">
                  {format.money(agency.gmvMonthMillimes)}
                </span>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function AgenciesView() {
  const t = useTranslations('admin.agencies');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const filter = params.filter as AgencyFilter;
  const query = { search: params.q, filter, page: Number(params.page) };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useAgencies(query);

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );
  const openAgency = useCallback(
    (agency: string) => {
      setParams({ agency });
    },
    [setParams],
  );
  const filtered = query.search.length > 0 || filter !== 'all';

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={
          data === undefined
            ? t('subtitle')
            : t('summary', { count: data.counts.all, pending: data.counts.pending })
        }
      />

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
          icon={Building2}
          title={filtered ? t('emptyFilteredTitle') : t('emptyTitle')}
          description={filtered ? t('emptyFilteredText') : t('emptyText')}
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
            <AgenciesTable agencies={data.items} onOpen={openAgency} />
          </div>
          <div className="lg:hidden">
            <AgencyCards agencies={data.items} onOpen={openAgency} />
          </div>
          <PaginationBar
            data={data}
            onPageChange={(page) => {
              setParams({ page: String(page) });
            }}
          />
        </div>
      )}

      <AgencySheet
        agencyId={params.agency.length > 0 ? params.agency : null}
        onClose={() => {
          setParams({ agency: '' });
        }}
      />
    </div>
  );
}

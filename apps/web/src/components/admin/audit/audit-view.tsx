'use client';

import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { Lock, ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { FilterTabs } from '@/components/agency/filter-tabs';
import { PageHeader } from '@/components/agency/page-header';
import { PaginationBar } from '@/components/agency/pagination-bar';
import { QueryError, TableSkeleton } from '@/components/agency/query-states';
import { SearchField } from '@/components/agency/search-field';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import { useAuditLog } from '@/lib/admin/queries';
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEntry } from '@/lib/admin/types';

import { AuditIcon, useActorLabel } from '../activity';

const CATEGORIES: readonly (AuditCategory | 'all')[] = ['all', ...AUDIT_CATEGORIES];
const URL_DEFAULTS = { q: '', category: 'all', page: '1' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  if (key === 'category') {
    return (CATEGORIES as readonly string[]).includes(value);
  }
  return key !== 'page' || /^\d+$/.test(value);
}

function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations('admin.audit');
  const tCommon = useTranslations('admin.common');
  const format = useAgencyFormat();
  const actorLabel = useActorLabel();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.date')}</TableHead>
          <TableHead>{t('columns.action')}</TableHead>
          <TableHead>{t('columns.actor')}</TableHead>
          <TableHead>{t('columns.target')}</TableHead>
          <TableHead>{t('columns.ip')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-sm tabular-nums">
              {format.date(entry.createdAt)}
              <span className="block text-xs text-muted-foreground">
                {format.time(entry.createdAt)}
              </span>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2.5">
                <AuditIcon action={entry.action} />
                <span className="text-sm font-medium">{t(`actions.${entry.action}`)}</span>
              </span>
            </TableCell>
            <TableCell>
              <span className="grid">
                <span className="text-sm">{actorLabel(entry)}</span>
                {entry.actor !== null && (
                  <span className="text-xs text-muted-foreground">
                    {tCommon(`userRoles.${entry.actor.role}`)}
                  </span>
                )}
              </span>
            </TableCell>
            <TableCell className="max-w-sm">
              <span className="grid gap-0.5">
                <span className="text-sm">{entry.target ?? '—'}</span>
                {entry.detail !== null && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{entry.detail}</span>
                )}
              </span>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
              {entry.ip ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AuditCards({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations('admin.audit');
  const format = useAgencyFormat();
  const actorLabel = useActorLabel();
  return (
    <ul className="grid gap-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Card className="flex gap-3 p-4">
            <AuditIcon action={entry.action} />
            <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
              <p className="font-medium">{t(`actions.${entry.action}`)}</p>
              {entry.target !== null && <p className="truncate">{entry.target}</p>}
              {entry.detail !== null && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{entry.detail}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {actorLabel(entry)} · {format.shortDateTime(entry.createdAt)}
              </p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function AuditView() {
  const t = useTranslations('admin.audit');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const category = params.category as AuditCategory | 'all';
  const query = { search: params.q, category, page: Number(params.page) };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useAuditLog(query);

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );
  const filtered = query.search.length > 0 || category !== 'all';

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            {t('immutable')}
          </span>
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
          value={category}
          onValueChange={(value) => {
            setParams({ category: value, page: '1' });
          }}
          options={CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }))}
        />
      </div>

      {isPending ? (
        <TableSkeleton rows={10} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setParams({ q: '', category: 'all', page: '1' });
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
            <AuditTable entries={data.items} />
          </div>
          <div className="lg:hidden">
            <AuditCards entries={data.items} />
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

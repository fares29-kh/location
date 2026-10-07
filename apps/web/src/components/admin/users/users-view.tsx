'use client';

import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { ChevronRight, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { FilterTabs } from '@/components/agency/filter-tabs';
import { PageHeader } from '@/components/agency/page-header';
import { PaginationBar } from '@/components/agency/pagination-bar';
import { QueryError, TableSkeleton } from '@/components/agency/query-states';
import { SearchField } from '@/components/agency/search-field';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import { useUsers } from '@/lib/admin/queries';
import type { PlatformUser, UserFilter } from '@/lib/admin/types';

import { PersonIdentity } from '../person';
import { RoleTag, UserStatusTag } from '../status-tags';
import { UserSheet } from './user-sheet';

const FILTERS: readonly UserFilter[] = ['all', 'customers', 'agency', 'admins', 'suspended'];
const URL_DEFAULTS = { q: '', filter: 'all', page: '1', user: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  if (key === 'filter') {
    return (FILTERS as readonly string[]).includes(value);
  }
  return key !== 'page' || /^\d+$/.test(value);
}

function OpenButton({
  user,
  onOpen,
  className,
}: {
  user: PlatformUser;
  onOpen: (id: string) => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(user.id);
      }}
      className={cn(
        'min-w-0 text-start focus-visible:outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring',
        className,
      )}
    >
      <PersonIdentity person={user} />
    </button>
  );
}

function Context({ user }: { user: PlatformUser }) {
  const t = useTranslations('admin.users');
  if (user.agency !== null) {
    return <span className="text-sm">{user.agency.name}</span>;
  }
  if (user.role === 'CUSTOMER') {
    return (
      <span className="text-sm text-muted-foreground">
        {t('bookingsCount', { count: user.bookingsCount })}
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">DriveTN</span>;
}

function UsersTable({ users, onOpen }: { users: PlatformUser[]; onOpen: (id: string) => void }) {
  const t = useTranslations('admin.users');
  const format = useAgencyFormat();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.user')}</TableHead>
          <TableHead>{t('columns.role')}</TableHead>
          <TableHead>{t('columns.context')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
          <TableHead>{t('columns.createdAt')}</TableHead>
          <TableHead>{t('columns.lastLogin')}</TableHead>
          <TableHead>
            <span className="sr-only">{t('columns.open')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id} className="group relative">
            <TableCell>
              <OpenButton user={user} onOpen={onOpen} className="after:rounded-sm" />
            </TableCell>
            <TableCell>
              <RoleTag role={user.role} adminRole={user.adminRole} />
            </TableCell>
            <TableCell>
              <Context user={user} />
            </TableCell>
            <TableCell>
              <UserStatusTag status={user.status} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {format.date(user.createdAt)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {user.lastLoginAt === null ? '—' : format.relative(user.lastLoginAt)}
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

function UserCards({ users, onOpen }: { users: PlatformUser[]; onOpen: (id: string) => void }) {
  return (
    <ul className="grid gap-3">
      {users.map((user) => (
        <li key={user.id}>
          <Card className="relative grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <OpenButton user={user} onOpen={onOpen} className="after:rounded-card" />
              <UserStatusTag status={user.status} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <RoleTag role={user.role} adminRole={user.adminRole} />
              <Context user={user} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function UsersView() {
  const t = useTranslations('admin.users');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const filter = params.filter as UserFilter;
  const query = { search: params.q, filter, page: Number(params.page) };
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useUsers(query);

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q, page: '1' });
    },
    [setParams],
  );
  const openUser = useCallback(
    (user: string) => {
      setParams({ user });
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
          icon={UsersRound}
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
            <UsersTable users={data.items} onOpen={openUser} />
          </div>
          <div className="lg:hidden">
            <UserCards users={data.items} onOpen={openUser} />
          </div>
          <PaginationBar
            data={data}
            onPageChange={(page) => {
              setParams({ page: String(page) });
            }}
          />
        </div>
      )}

      <UserSheet
        userId={params.user.length > 0 ? params.user : null}
        onClose={() => {
          setParams({ user: '' });
        }}
      />
    </div>
  );
}

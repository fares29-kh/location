'use client';

import { Pagination } from '@drivetn/ui/pagination';
import { useTranslations } from 'next-intl';

import type { Paginated } from '@/lib/agency/types';

import { useAgencyFormat } from './use-agency-format';

/** Position dans la liste (« 11–20 sur 87 ») et navigation entre les pages. */
export function PaginationBar({
  data,
  onPageChange,
}: {
  data: Pick<Paginated<unknown>, 'page' | 'pageSize' | 'pageCount' | 'total'>;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('agency.common.pagination');
  const format = useAgencyFormat();
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('range', {
          from: format.integer((data.page - 1) * data.pageSize + 1),
          to: format.integer(Math.min(data.page * data.pageSize, data.total)),
          total: data.total,
        })}
      </p>
      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        onPageChange={(page) => {
          onPageChange(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        labels={{
          navigation: t('label'),
          previous: t('previous'),
          next: t('next'),
          page: (page) => t('page', { page }),
        }}
      />
    </div>
  );
}

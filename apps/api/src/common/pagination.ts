import { AGENCY_LIST_LIMIT_DEFAULT, type Paginated } from '@drivetn/types';

export interface PageWindow {
  page: number;
  pageSize: number;
  pageCount: number;
  skip: number;
  take: number;
}

/** Une page hors limites est ramenée dans [1, pageCount] : la dernière page reste affichée. */
export function pageWindow(
  total: number,
  page: number,
  pageSize: number = AGENCY_LIST_LIMIT_DEFAULT,
): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { page: current, pageSize, pageCount, skip: (current - 1) * pageSize, take: pageSize };
}

export function toPaginated<T>(items: T[], total: number, window: PageWindow): Paginated<T> {
  return {
    items,
    total,
    page: window.page,
    pageSize: window.pageSize,
    pageCount: window.pageCount,
  };
}

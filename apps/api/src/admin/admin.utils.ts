import { ADMIN_PAGE_SIZE, addMonths, type Paginated, tunisDateTime } from '@drivetn/types';

export interface PageWindow {
  page: number;
  pageSize: number;
  pageCount: number;
  skip: number;
}

/** Page demandée ramenée dans les bornes, avec le décalage SQL correspondant. */
export function pageWindow(page: number, total: number, pageSize = ADMIN_PAGE_SIZE): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { page: current, pageSize, pageCount, skip: (current - 1) * pageSize };
}

export function paginated<T>(items: T[], total: number, window: PageWindow): Paginated<T> {
  return {
    items,
    total,
    page: window.page,
    pageSize: window.pageSize,
    pageCount: window.pageCount,
  };
}

/** Filtre « contient », insensible à la casse. */
export function contains(search: string) {
  return { contains: search, mode: 'insensitive' as const };
}

/** Bornes d'un mois « AAAA-MM » à l'heure de Tunis : [start, end[. */
export function monthBounds(month: string): { start: Date; end: Date } {
  return {
    start: tunisDateTime(`${month}-01`, 0),
    end: tunisDateTime(`${addMonths(month, 1)}-01`, 0),
  };
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

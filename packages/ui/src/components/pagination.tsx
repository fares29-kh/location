'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from './button';

export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/** Pages visibles : toujours la première et la dernière, plus `siblings` autour de la page courante. */
export function getPageItems(page: number, pageCount: number, siblings = 1): PageItem[] {
  const total = siblings * 2 + 5;
  if (pageCount <= total) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const start = Math.max(2, Math.min(page - siblings, pageCount - siblings * 2 - 2));
  const end = Math.min(pageCount - 1, Math.max(page + siblings, siblings * 2 + 3));
  const items: PageItem[] = [1];
  if (start > 2) {
    items.push('ellipsis-start');
  }
  for (let current = start; current <= end; current += 1) {
    items.push(current);
  }
  if (end < pageCount - 1) {
    items.push('ellipsis-end');
  }
  items.push(pageCount);
  return items;
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  labels: {
    navigation: string;
    previous: string;
    next: string;
    page: (page: number) => string;
  };
  className?: string;
}

export function Pagination({ page, pageCount, onPageChange, labels, className }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={labels.navigation}
      className={cn('flex items-center justify-center', className)}
    >
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.previous}
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
          >
            <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
          </Button>
        </li>
        {getPageItems(page, pageCount).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <Button
                variant={item === page ? 'primary' : 'ghost'}
                size="icon-sm"
                aria-label={labels.page(item)}
                aria-current={item === page ? 'page' : undefined}
                className="tabular-nums"
                onClick={() => {
                  onPageChange(item);
                }}
              >
                {item}
              </Button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ),
        )}
        <li>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.next}
            disabled={page >= pageCount}
            onClick={() => {
              onPageChange(page + 1);
            }}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
          </Button>
        </li>
      </ul>
    </nav>
  );
}

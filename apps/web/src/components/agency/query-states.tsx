'use client';

import { Card } from '@drivetn/ui/card';
import { ErrorState } from '@drivetn/ui/error-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Skeleton } from '@drivetn/ui/skeleton';
import { useTranslations } from 'next-intl';

import { ApiError } from '@/lib/api/errors';

/** Erreur de chargement d'une requête, avec bouton « Réessayer ». */
export function QueryError({
  error,
  onRetry,
  retrying = false,
  className,
}: {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const t = useTranslations('agency.common');
  const tCommon = useTranslations('common');
  const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
  return (
    <ErrorState
      className={className}
      title={notFound ? t('notFoundTitle') : t('loadErrorTitle')}
      description={notFound ? t('notFoundText') : t('loadErrorText')}
      retryLabel={notFound ? undefined : tCommon('retry')}
      onRetry={notFound ? undefined : onRetry}
      retrying={retrying}
    />
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="grid gap-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  const t = useTranslations('agency.common');
  return (
    <Card className={cn('grid gap-0 overflow-hidden', className)} aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-11 border-b border-border bg-surface-muted" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          <Skeleton className="hidden h-4 w-16 md:block" />
        </div>
      ))}
    </Card>
  );
}

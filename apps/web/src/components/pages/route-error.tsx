'use client';

import { ErrorState } from '@drivetn/ui/error-state';
import { useTranslations } from 'next-intl';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Contenu des pages `error.tsx` : message traduit et bouton « Réessayer ». */
export function RouteError({ reset }: RouteErrorProps) {
  const t = useTranslations();
  return (
    <div className="container py-16">
      <ErrorState
        title={t('routeError.title')}
        description={t('routeError.description')}
        retryLabel={t('common.retry')}
        onRetry={reset}
      />
    </div>
  );
}

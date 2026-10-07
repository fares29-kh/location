import { EmptyState } from '@drivetn/ui/empty-state';
import { LayoutDashboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { ApiStatus, ApiStatusSkeleton } from '@/components/api-status';

/** Accueil des espaces agence et admin (tableaux de bord livrés dans les phases suivantes). */
export function WorkspaceHome({ portal }: { portal: 'agency' | 'admin' }) {
  const t = useTranslations(`${portal}.home`);
  const tStatus = useTranslations('apiStatus');

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <EmptyState
          className="bg-surface lg:col-span-2"
          icon={LayoutDashboard}
          title={t('emptyTitle')}
          description={t('emptyText')}
        />
        <Suspense fallback={<ApiStatusSkeleton title={tStatus('title')} />}>
          <ApiStatus />
        </Suspense>
      </div>
    </div>
  );
}

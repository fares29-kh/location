import type { DependencyStatus, HealthStatus } from '@drivetn/types';
import { Badge, type BadgeTone } from '@drivetn/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@drivetn/ui/card';
import { Skeleton } from '@drivetn/ui/skeleton';
import { Activity } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { fetchApiHealth } from '@/lib/api-health';

const STATUS_TONES: Record<HealthStatus | 'unreachable', BadgeTone> = {
  ok: 'success',
  degraded: 'warning',
  error: 'danger',
  unreachable: 'danger',
};

const CHECKS = ['database', 'redis', 'worker'] as const;

function DependencyDot({ status }: { status: DependencyStatus }) {
  return (
    <span
      aria-hidden="true"
      className={
        status === 'up' ? 'size-2 rounded-full bg-success' : 'size-2 rounded-full bg-danger'
      }
    />
  );
}

function ApiStatusFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** État de l'API et de ses dépendances (lu côté serveur à chaque requête). */
export async function ApiStatus() {
  const [t, health] = await Promise.all([getTranslations('apiStatus'), fetchApiHealth()]);
  const overall = health?.status ?? 'unreachable';

  return (
    <ApiStatusFrame title={t('title')}>
      <div role="status" className="grid gap-4">
        <Badge tone={STATUS_TONES[overall]} className="w-fit text-sm">
          {t(`status.${overall}`)}
        </Badge>
        {health !== null && (
          <ul className="grid gap-2 text-sm">
            {CHECKS.map((check) => (
              <li key={check} className="flex items-center gap-2">
                <DependencyDot status={health.checks[check]} />
                <span className="flex-1 text-foreground">{t(`checks.${check}`)}</span>
                <span className="text-muted-foreground">
                  {health.checks[check] === 'up' ? t('up') : t('down')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ApiStatusFrame>
  );
}

export function ApiStatusSkeleton({ title }: { title: string }) {
  return (
    <ApiStatusFrame title={title}>
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-6 w-32 rounded-full" />
        {CHECKS.map((check) => (
          <Skeleton key={check} className="h-5 w-full" />
        ))}
      </div>
    </ApiStatusFrame>
  );
}

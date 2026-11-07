'use client';

import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Skeleton } from '@drivetn/ui/skeleton';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { usePlanUsage } from '@/lib/agency/queries';

export function PlanQuota() {
  const t = useTranslations('agency.fleet');
  const { data: planUsage, isPending } = usePlanUsage();

  if (isPending) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  if (planUsage?.vehiclesLimit === null || planUsage?.vehiclesLimit === undefined) {
    return null;
  }

  const { vehiclesCount, vehiclesLimit } = planUsage;
  const percentUsed = Math.round((vehiclesCount / vehiclesLimit) * 100);
  const isNearLimit = percentUsed >= 80;
  const isAtLimit = vehiclesCount >= vehiclesLimit;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">{t('planQuota.label')}</span>
          <span className="font-semibold tabular-nums">
            {vehiclesCount} / {vehiclesLimit}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="meter"
          aria-label={t('planQuota.label')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentUsed}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(100, percentUsed)}%` }}
          />
        </div>
      </div>

      {isAtLimit && (
        <Alert tone="danger" title={t('planQuota.limitReachedTitle')}>
          <p>{t('planQuota.limitReachedText')}</p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/settings">{t('planQuota.upgrade')}</Link>
          </Button>
        </Alert>
      )}

      {isNearLimit && !isAtLimit && (
        <Alert tone="warning" title={t('planQuota.nearLimitTitle')}>
          <p>{t('planQuota.nearLimitText', { remaining: vehiclesLimit - vehiclesCount })}</p>
          <Button asChild size="sm" variant="secondary">
            <Link href="/settings">{t('planQuota.upgrade')}</Link>
          </Button>
        </Alert>
      )}
    </div>
  );
}

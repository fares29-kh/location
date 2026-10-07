import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Card } from './card';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  /** Variation affichée sous la valeur (ex. « +12 % ce mois »). */
  trend?: ReactNode;
  trendDirection?: 'up' | 'down' | 'neutral';
  className?: string;
}

const TREND_CLASSES = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted-foreground',
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = 'neutral',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-4 p-5', className)}>
      <div className="grid min-w-0 gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate font-heading text-xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        {trend !== undefined && (
          <p className={cn('text-xs font-medium', TREND_CLASSES[trendDirection])}>{trend}</p>
        )}
      </div>
      {Icon !== undefined && (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary-soft-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
    </Card>
  );
}

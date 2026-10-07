import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn';

const alertVariants = cva('flex gap-3 rounded-card border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-info/30 bg-info-soft text-info-soft-foreground',
      success: 'border-success/30 bg-success-soft text-success-soft-foreground',
      warning: 'border-warning/30 bg-warning-soft text-warning-soft-foreground',
      danger: 'border-danger/30 bg-danger-soft text-danger-soft-foreground',
    },
  },
  defaultVariants: { tone: 'info' },
});

type AlertTone = NonNullable<VariantProps<typeof alertVariants>['tone']>;

const ALERT_ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export interface AlertProps
  extends Omit<ComponentProps<'div'>, 'title'>, VariantProps<typeof alertVariants> {
  title?: ReactNode;
  /** Bouton ou lien d'action affiché sous le message. */
  action?: ReactNode;
}

export function Alert({ className, tone, title, action, children, ...props }: AlertProps) {
  const resolvedTone = tone ?? 'info';
  const Icon = ALERT_ICONS[resolvedTone];
  return (
    <div
      role={resolvedTone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone: resolvedTone }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="grid gap-1">
        {title !== undefined && <p className="font-semibold">{title}</p>}
        {children !== undefined && <div className="opacity-90">{children}</div>}
        {action !== undefined && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

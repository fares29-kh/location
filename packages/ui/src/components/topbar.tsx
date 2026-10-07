import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

/** Barre supérieure collante, translucide, avec zones début / milieu / fin. */
export function Topbar({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

export function TopbarSection({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />;
}

export function TopbarSpacer() {
  return <div className="flex-1" />;
}

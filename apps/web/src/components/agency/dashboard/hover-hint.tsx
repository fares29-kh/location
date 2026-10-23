'use client';

import { cn } from '@drivetn/ui/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import type { ReactNode } from 'react';

/** Affiche un court texte au survol ou au focus clavier. */
export function HoverHint({
  hint,
  children,
  className,
}: {
  hint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'cursor-help rounded-sm text-start underline decoration-dotted decoration-muted-foreground/70 underline-offset-4',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-balance">{hint}</TooltipContent>
    </Tooltip>
  );
}

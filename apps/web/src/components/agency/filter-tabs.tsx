'use client';

import { cn } from '@drivetn/ui/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';

export interface FilterTabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Texte affiché au survol du filtre. */
  hint?: string;
}

export interface FilterTabsProps<T extends string> {
  label: string;
  value: T;
  options: readonly FilterTabOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
}

/** Filtres rapides exclusifs (boutons bascule) avec compteur, défilables sur mobile. */
export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        '-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const button = (
          <button
            key={option.hint === undefined ? option.value : undefined}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onValueChange(option.value);
            }}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              selected
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums',
                  selected ? 'bg-white/20' : 'bg-surface-muted',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
        if (option.hint === undefined) {
          return button;
        }
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent className="max-w-64 text-balance">{option.hint}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

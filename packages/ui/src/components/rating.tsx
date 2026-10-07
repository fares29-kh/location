import { Star } from 'lucide-react';

import { cn } from '../lib/cn';

export interface RatingProps {
  /** Note entre 0 et `max` (décimales acceptées, arrondies à la demi-étoile). */
  value: number;
  max?: number;
  /** Libellé accessible (ex. « 4,5 sur 5 »). */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function roundToHalf(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value * 2) / 2));
}

export function Rating({ value, max = 5, label, size = 'sm', className }: RatingProps) {
  const rounded = roundToHalf(value, max);
  const iconClass = size === 'sm' ? 'size-4' : 'size-5';

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {Array.from({ length: max }, (_, index) => {
        const fill = Math.min(1, Math.max(0, rounded - index));
        return (
          <span key={index} className={cn('relative', iconClass)} data-fill={fill}>
            <Star className={cn('absolute inset-0 text-border', iconClass)} fill="currentColor" />
            {fill > 0 && (
              <span
                className="absolute inset-y-0 start-0 overflow-hidden"
                style={{ width: `${String(fill * 100)}%` }}
              >
                <Star className={cn('max-w-none text-amber-400', iconClass)} fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

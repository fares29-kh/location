import { formatMillimes, type Locale } from '@drivetn/types';

import { cn } from '../lib/cn';

export interface MoneyProps {
  /** Montant entier en millimes (1 DT = 1000 millimes). */
  millimes: number;
  locale: Locale;
  withCurrency?: boolean;
  className?: string;
}

export function Money({ millimes, locale, withCurrency = true, className }: MoneyProps) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {formatMillimes(millimes, locale, { withCurrency })}
    </span>
  );
}

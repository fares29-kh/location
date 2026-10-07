import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';

export const inputClassName = cn(
  'flex h-11 w-full min-w-0 rounded-control border border-input bg-surface px-3 text-base text-foreground shadow-sm sm:text-sm',
  'placeholder:text-muted-foreground transition-colors',
  'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30',
  'file:border-0 file:bg-transparent file:text-sm file:font-medium',
);

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(inputClassName, className)} {...props} />;
}

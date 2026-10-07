import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { inputClassName } from './input';

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea rows={rows} className={cn(inputClassName, 'h-auto py-2.5', className)} {...props} />
  );
}

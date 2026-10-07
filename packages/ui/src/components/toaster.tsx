'use client';

import type { ComponentProps } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

export { toast } from 'sonner';

export interface ToasterProps extends ComponentProps<typeof SonnerToaster> {
  dir?: 'ltr' | 'rtl';
}

export function Toaster({ dir = 'ltr', position, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      dir={dir}
      position={position ?? (dir === 'rtl' ? 'top-left' : 'top-right')}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-card border border-border font-sans shadow-elevated',
          title: 'font-semibold',
          description: 'text-sm',
        },
      }}
      {...props}
    />
  );
}

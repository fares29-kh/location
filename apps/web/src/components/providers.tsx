'use client';

import type { Direction } from '@drivetn/types';
import { DirectionProvider } from '@drivetn/ui/direction';
import { Toaster } from '@drivetn/ui/toaster';
import { TooltipProvider } from '@drivetn/ui/tooltip';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ReactNode } from 'react';

function ThemedToaster({ dir }: { dir: Direction }) {
  const { resolvedTheme } = useTheme();
  return <Toaster dir={dir} theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}

export function Providers({ dir, children }: { dir: Direction; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DirectionProvider dir={dir}>
        <TooltipProvider delayDuration={200}>
          {children}
          <ThemedToaster dir={dir} />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}

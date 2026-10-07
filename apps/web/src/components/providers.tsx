'use client';

import type { Direction } from '@drivetn/types';
import { DirectionProvider } from '@drivetn/ui/direction';
import { Toaster } from '@drivetn/ui/toaster';
import { TooltipProvider } from '@drivetn/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { type ReactNode, useState } from 'react';

import { ApiError } from '@/lib/api/errors';

function ThemedToaster({ dir }: { dir: Direction }) {
  const { resolvedTheme } = useTheme();
  return <Toaster dir={dir} theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}

/** Réessaie les erreurs réseau et serveur (connexion instable), jamais les erreurs métier. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status > 0 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function Providers({ dir, children }: { dir: Direction; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <DirectionProvider dir={dir}>
          <TooltipProvider delayDuration={200}>
            {children}
            <ThemedToaster dir={dir} />
          </TooltipProvider>
        </DirectionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

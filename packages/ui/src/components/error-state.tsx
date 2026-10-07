'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';

export interface ErrorStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Libellé du bouton « Réessayer » ; le bouton n'est affiché qu'avec `onRetry`. */
  retryLabel?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger/20 bg-danger-soft/40 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger-soft-foreground">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
      {description !== undefined && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry !== undefined && retryLabel !== undefined && (
        <Button variant="secondary" className="mt-2" onClick={onRetry} loading={retrying}>
          {!retrying && <RotateCw aria-hidden="true" />}
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

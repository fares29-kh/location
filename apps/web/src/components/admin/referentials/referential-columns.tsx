'use client';

import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card, CardHeader, CardTitle } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import { Skeleton } from '@drivetn/ui/skeleton';
import { ChevronRight, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/** Colonne d'un référentiel hiérarchique : titre, outils (ajout, recherche) et liste ou état vide. */
export function ReferentialColumn({
  title,
  count,
  action,
  toolbar,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  /** Sous l'en-tête, au-dessus de la liste (ex. champ de recherche). */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border py-3">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <span className="truncate">{title}</span>
          {count !== undefined && (
            <Badge tone="neutral" className="tabular-nums">
              {count}
            </Badge>
          )}
        </CardTitle>
        {action}
      </CardHeader>
      {toolbar !== undefined && <div className="border-b border-border p-3">{toolbar}</div>}
      <div className="max-h-[32rem] min-h-40 overflow-y-auto">{children}</div>
    </Card>
  );
}

export function ColumnMessage({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function ColumnSkeleton() {
  return (
    <div className="grid gap-3 p-4" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-10" />
      ))}
    </div>
  );
}

/** Ligne sélectionnable (élément parent) ou simple ligne (dernier niveau). */
export function ReferentialRow({
  title,
  meta,
  selected,
  onSelect,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
}) {
  const content = (
    <span className="grid min-w-0 gap-0.5">
      <span className="truncate font-medium">{title}</span>
      {meta !== undefined && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
    </span>
  );
  return (
    <li
      className={cn(
        'flex items-center gap-2 border-b border-border pe-2 last:border-0',
        selected === true && 'bg-primary-soft/60',
      )}
    >
      {onSelect === undefined ? (
        <div className="min-w-0 flex-1 py-2.5 ps-4">{content}</div>
      ) : (
        <button
          type="button"
          aria-current={selected === true ? 'true' : undefined}
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 ps-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {content}
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground rtl:rotate-180',
              selected === true && 'text-primary',
            )}
            aria-hidden="true"
          />
        </button>
      )}
      {actions}
    </li>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}

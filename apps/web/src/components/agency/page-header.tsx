import { cn } from '@drivetn/ui/lib/cn';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Petit libellé au-dessus du titre (ex. salutation, référence). */
  eyebrow?: ReactNode;
  /** Lien de retour vers la liste parente. */
  back?: { href: string; label: string };
  actions?: ReactNode;
  className?: string;
}

/** En-tête commun des écrans de l'espace agence : titre, contexte et actions principales. */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('grid gap-4', className)}>
      {back !== undefined && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-control text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          {eyebrow !== undefined && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description !== undefined && (
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
          )}
        </div>
        {actions !== undefined && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

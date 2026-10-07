import { cn } from '@drivetn/ui/lib/cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const ENTER = 'animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700';

/** Bandeau d'en-tête des pages du portail client, dans l'esprit du hero de l'accueil. */
export function PageHero({
  id,
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Boutons alignés avec le titre sur grand écran. */
  actions?: ReactNode;
  /** Contenu sous le titre (formulaire, statistiques...). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('relative isolate overflow-hidden border-b border-border', className)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-48 start-[10%] size-[32rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -end-32 top-10 size-[22rem] rounded-full bg-info/15 blur-3xl" />
      </div>

      <div className="container grid gap-8 py-10 sm:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid max-w-2xl gap-4">
            <span
              className={`${ENTER} inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-soft-foreground`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {eyebrow}
            </span>
            <h1
              id={id}
              className={`${ENTER} text-[2rem] font-extrabold leading-tight tracking-tight delay-100 sm:text-[2.5rem] rtl:leading-[1.35]`}
            >
              {title}
            </h1>
            {subtitle !== undefined && (
              <p className={`${ENTER} text-base text-muted-foreground delay-200 sm:text-lg`}>
                {subtitle}
              </p>
            )}
          </div>
          {actions !== undefined && (
            <div className={`${ENTER} flex flex-wrap gap-2 delay-300`}>{actions}</div>
          )}
        </div>
        {children !== undefined && <div className={`${ENTER} delay-300`}>{children}</div>}
      </div>
    </section>
  );
}

import type { LucideIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface SidebarProps extends ComponentProps<'aside'> {
  /** Réduit la barre aux icônes (les libellés restent lisibles par les lecteurs d'écran). */
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false, className, ...props }: SidebarProps) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'group/sidebar flex h-full flex-col border-e border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-64',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex h-16 shrink-0 items-center gap-2 border-b border-border px-4', className)}
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: ComponentProps<'nav'>) {
  return (
    <nav className={cn('flex flex-1 flex-col gap-6 overflow-y-auto p-3', className)} {...props} />
  );
}

export function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('shrink-0 border-t border-border p-3', className)} {...props} />;
}

export interface SidebarSectionProps extends Omit<ComponentProps<'div'>, 'title'> {
  title?: ReactNode;
}

export function SidebarSection({ title, className, children, ...props }: SidebarSectionProps) {
  return (
    <div className={cn('grid gap-1', className)} {...props}>
      {title !== undefined && (
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsed=true]/sidebar:sr-only">
          {title}
        </p>
      )}
      <ul className="grid gap-1">{children}</ul>
    </div>
  );
}

export interface SidebarItemProps {
  icon: LucideIcon;
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Pastille affichée en fin de ligne (ex. « Bientôt », compteur). */
  badge?: ReactNode;
  /** Élément de lien fourni par l'application (ex. `<Link href="…" />`). */
  children?: ReactNode;
  className?: string;
}

const itemClassName = cn(
  'flex min-h-touch w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-0',
);

/**
 * Entrée de navigation. Avec un enfant (lien), l'enfant reçoit les styles via Slot ;
 * sans enfant ou si `disabled`, l'entrée est rendue comme un élément inerte.
 */
export function SidebarItem({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  badge,
  children,
  className,
}: SidebarItemProps) {
  const content = (
    <>
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate text-start group-data-[collapsed=true]/sidebar:sr-only">
        {label}
      </span>
      {badge !== undefined && (
        <span className="group-data-[collapsed=true]/sidebar:hidden">{badge}</span>
      )}
    </>
  );

  if (disabled || children === undefined) {
    return (
      <li>
        <span
          aria-disabled={disabled || undefined}
          className={cn(itemClassName, 'cursor-not-allowed text-muted-foreground/70', className)}
        >
          {content}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Slot.Root
        aria-current={active ? 'page' : undefined}
        className={cn(
          itemClassName,
          active
            ? 'bg-primary-soft text-primary-soft-foreground'
            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
          className,
        )}
      >
        <Slot.Slottable>{children}</Slot.Slottable>
        {content}
      </Slot.Root>
    </li>
  );
}

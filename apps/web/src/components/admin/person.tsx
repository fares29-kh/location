'use client';

import { Avatar, AvatarFallback, getInitials } from '@drivetn/ui/avatar';
import { cn } from '@drivetn/ui/lib/cn';

import { displayPhone } from '@/components/auth/otp-step';

export function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

/** Avatar, nom et ligne secondaire (téléphone par défaut) d'une personne ou d'une agence. */
export function Identity({
  name,
  secondary,
  size = 'sm',
  square = false,
  className,
}: {
  name: string;
  secondary?: string | null;
  size?: 'sm' | 'lg';
  /** Avatar carré, réservé aux agences. */
  square?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar className={cn(size === 'lg' ? 'size-14' : 'size-9', square && 'rounded-control')}>
        <AvatarFallback
          className={cn(
            size === 'lg' ? 'text-lg' : 'text-xs',
            square && 'rounded-control bg-primary-soft text-primary-soft-foreground',
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0">
        <span
          className={cn(
            'truncate font-medium text-foreground',
            size === 'lg' && 'font-heading text-lg font-semibold',
          )}
        >
          {name}
        </span>
        {secondary !== undefined && secondary !== null && (
          <span className="truncate text-xs text-muted-foreground tabular-nums">{secondary}</span>
        )}
      </span>
    </span>
  );
}

export function PersonIdentity({
  person,
  size,
  className,
}: {
  person: { firstName: string; lastName: string; phone: string };
  size?: 'sm' | 'lg';
  className?: string;
}) {
  return (
    <Identity
      name={personName(person)}
      secondary={displayPhone(person.phone)}
      size={size}
      className={className}
    />
  );
}

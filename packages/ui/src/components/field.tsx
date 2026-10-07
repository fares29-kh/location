import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Label } from './label';

export interface FieldProps {
  /** Identifiant du contrôle de formulaire enveloppé. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Texte affiché à côté du libellé pour un champ obligatoire (ex. « * »). */
  requiredIndicator?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Ids à passer en `aria-describedby` au contrôle pour relier l'aide et l'erreur. */
export function fieldDescribedBy(
  id: string,
  { hint, error }: { hint?: unknown; error?: unknown },
): string | undefined {
  const ids = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ].filter((value): value is string => value !== null);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function Field({
  id,
  label,
  hint,
  error,
  requiredIndicator,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('grid content-start gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {requiredIndicator !== undefined && (
          <span className="ms-1 text-danger" aria-hidden="true">
            {requiredIndicator}
          </span>
        )}
      </Label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

'use client';

import { formatNationalPhone, normalizeTunisianPhone, TUNISIA_DIAL_CODE } from '@drivetn/types';
import type { ChangeEvent, ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { inputClassName } from './input';

export interface PhoneInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> {
  /** Chiffres nationaux (8 maximum), sans indicatif. */
  value: string;
  onValueChange: (nationalDigits: string) => void;
}

/**
 * Saisie d'un numéro tunisien : indicatif +216 fixe, groupement « XX XXX XXX ».
 * Accepte le collage d'un numéro complet (+216..., 00216...).
 * Toujours affiché de gauche à droite, y compris en arabe.
 */
export function PhoneInput({ value, onValueChange, className, ...props }: PhoneInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onValueChange(normalizeTunisianPhone(event.target.value).slice(0, 8));
  }

  return (
    <div
      dir="ltr"
      className={cn(
        inputClassName,
        'items-center gap-2 p-0 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
        'has-[[aria-invalid=true]]:border-danger',
        className,
      )}
    >
      <span className="flex h-full items-center border-e border-input ps-3 pe-2 text-muted-foreground tabular-nums">
        +{TUNISIA_DIAL_CODE}
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="XX XXX XXX"
        className="h-full min-w-0 flex-1 bg-transparent pe-3 tabular-nums outline-none placeholder:text-muted-foreground"
        value={formatNationalPhone(value)}
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}

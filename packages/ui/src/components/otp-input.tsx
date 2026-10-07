'use client';

import { type ClipboardEvent, type KeyboardEvent, useRef } from 'react';

import { cn } from '../lib/cn';

export interface OtpInputProps {
  /** Chiffres saisis (longueur ≤ `length`). */
  value: string;
  onValueChange: (value: string) => void;
  /** Appelé dès que tous les chiffres sont saisis. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  /** Libellé accessible de chaque case (ex. « Chiffre 1 sur 6 »). */
  getInputLabel: (index: number, length: number) => string;
  className?: string;
}

function onlyDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Saisie d'un code OTP chiffre par chiffre : avance automatique, retour arrière,
 * flèches, collage du code complet et remplissage automatique par SMS (one-time-code).
 */
export function OtpInput({
  value,
  onValueChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  getInputLabel,
  className,
}: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value.charAt(index));

  function focusAt(index: number) {
    const target = inputs.current[Math.max(0, Math.min(index, length - 1))];
    target?.focus();
    target?.select();
  }

  function commit(next: string) {
    const cleaned = onlyDigits(next).slice(0, length);
    onValueChange(cleaned);
    if (cleaned.length === length) {
      onComplete?.(cleaned);
    }
    return cleaned;
  }

  function handleInput(index: number, raw: string) {
    const typed = onlyDigits(raw);
    if (typed.length === 0) {
      return;
    }
    const next = commit(value.slice(0, index) + typed + value.slice(index + typed.length));
    focusAt(Math.min(index + typed.length, next.length));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index] !== '') {
        commit(value.slice(0, index) + value.slice(index + 1));
        focusAt(index);
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        focusAt(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const next = commit(event.clipboardData.getData('text'));
    focusAt(next.length);
  }

  return (
    <div dir="ltr" className={cn('flex gap-1.5 sm:gap-2', className)}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={getInputLabel(index, length)}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            handleInput(index, event.target.value);
          }}
          onKeyDown={(event) => {
            handleKeyDown(index, event);
          }}
          onPaste={handlePaste}
          onFocus={(event) => {
            event.target.select();
          }}
          className={cn(
            'size-11 rounded-control border border-input bg-surface text-center text-lg font-semibold tabular-nums text-foreground shadow-sm sm:size-12',
            'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-danger',
          )}
        />
      ))}
    </div>
  );
}

'use client';

import { Input } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

const DEBOUNCE_MS = 300;

export interface SearchFieldProps {
  value: string;
  /** Appelé après une courte pause de saisie (anti-rebond). */
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}

/** Recherche instantanée avec anti-rebond, effacement rapide et raccourci « / ». */
export function SearchField({
  value,
  onValueChange,
  label,
  placeholder,
  className,
}: SearchFieldProps) {
  const t = useTranslations('agency.common');
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  const timerRef = useRef<number | undefined>(undefined);

  function scheduleCommit(next: string) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onValueChange(next);
    }, DEBOUNCE_MS);
  }

  function clear() {
    window.clearTimeout(timerRef.current);
    setDraft('');
    onValueChange('');
  }

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className={cn('relative w-full sm:max-w-sm', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        id={id}
        type="search"
        value={draft}
        placeholder={placeholder ?? label}
        autoComplete="off"
        className="ps-9 pe-16 [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => {
          setDraft(event.target.value);
          scheduleCommit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && draft.length > 0) {
            event.stopPropagation();
            clear();
          }
        }}
      />
      {draft.length > 0 ? (
        <button
          type="button"
          className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('clearSearch')}
          onClick={() => {
            clear();
            inputRef.current?.focus();
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <kbd
          className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface-muted px-1.5 text-xs font-medium text-muted-foreground sm:block"
          aria-hidden="true"
        >
          /
        </kbd>
      )}
    </div>
  );
}

'use client';

import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import {
  type ComponentProps,
  type KeyboardEvent,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '../lib/cn';
import { inputClassName } from './input';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Termes supplémentaires pris en compte par la recherche. */
  keywords?: string;
}

export interface ComboboxProps extends Omit<
  ComponentProps<'button'>,
  'value' | 'onChange' | 'children' | 'type'
> {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  searchPlaceholder: string;
  emptyText: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterComboboxOptions(
  options: readonly ComboboxOption[],
  query: string,
): readonly ComboboxOption[] {
  const needle = normalize(query);
  if (needle.length === 0) {
    return options;
  }
  return options.filter((option) =>
    normalize(`${option.label} ${option.keywords ?? ''}`).includes(needle),
  );
}

/**
 * Liste de choix avec recherche (marques, modèles…). Le focus reste dans le champ de recherche ;
 * l'option active est annoncée via `aria-activedescendant`.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  disabled,
  ...props
}: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => filterComboboxOptions(options, query), [options, query]);
  const activeIndex = Math.min(active, filtered.length - 1);

  const scrollToIndex = (index: number) => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${String(index)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  /** À l'ouverture, l'option choisie est visible sans faire défiler la liste à la main. */
  const attachList = useCallback((node: HTMLUListElement | null) => {
    listRef.current = node;
    node?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery('');
      setActive(
        Math.max(
          0,
          options.findIndex((option) => option.value === value),
        ),
      );
    }
  };

  const choose = (option: ComboboxOption | undefined) => {
    if (option === undefined) {
      return;
    }
    onValueChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = filtered.length - 1;
    const move = (index: number) => {
      event.preventDefault();
      setActive(index);
      scrollToIndex(index);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(Math.min(activeIndex + 1, last));
        break;
      case 'ArrowUp':
        move(Math.max(activeIndex - 1, 0));
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(last);
        break;
      case 'Enter':
        event.preventDefault();
        choose(filtered[activeIndex]);
        break;
      default:
        break;
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            inputClassName,
            'items-center justify-between gap-2 text-start',
            selected === undefined && 'text-muted-foreground',
            className,
          )}
          {...props}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            'z-[90] w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-control border border-border bg-surface text-foreground shadow-elevated',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? `${listId}-${String(activeIndex)}` : undefined
              }
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                listRef.current?.scrollTo({ top: 0 });
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <ul
            ref={attachList}
            id={listId}
            role="listbox"
            aria-label={placeholder}
            className="max-h-64 overflow-y-auto overscroll-contain p-1"
          >
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${String(index)}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  data-index={index}
                  className={cn(
                    'relative flex min-h-10 cursor-pointer select-none items-center rounded-[0.375rem] py-2 pe-8 ps-2 text-sm',
                    index === activeIndex && 'bg-surface-muted',
                    isSelected && 'font-semibold',
                  )}
                  onPointerMove={() => {
                    setActive(index);
                  }}
                  onClick={() => {
                    choose(option);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      choose(option);
                    }
                  }}
                >
                  {option.label}
                  {isSelected && (
                    <Check className="absolute end-2 size-4 text-primary" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && (
            <p className="px-3 pb-5 pt-3 text-center text-sm text-muted-foreground">{emptyText}</p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

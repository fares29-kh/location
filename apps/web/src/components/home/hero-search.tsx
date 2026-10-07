'use client';

import { Button } from '@drivetn/ui/button';
import { inputClassName } from '@drivetn/ui/input';
import { Label } from '@drivetn/ui/label';
import { cn } from '@drivetn/ui/lib/cn';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@drivetn/ui/select';
import { CalendarDays, type LucideIcon, MapPin, Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useId, useMemo, useState, useSyncExternalStore } from 'react';

import { rentalDays } from '@/components/search/catalog';
import { buildSearchHref } from '@/components/search/search-href';
import { useRouter } from '@/i18n/navigation';
import { addDays, dayKeyToDate, isoWeekday, todayKey } from '@/lib/agency/dates';

import { AIRPORTS, CITIES } from './places';

const STORAGE_KEY = 'drivetn:last-search';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCATIONS: ReadonlySet<string> = new Set([
  ...AIRPORTS.map((airport) => airport.slug),
  ...CITIES,
]);

interface SearchDraft {
  location: string;
  pickup: string;
  dropoff: string;
}

const EMPTY_DRAFT: SearchDraft = { location: '', pickup: '', dropoff: '' };

const PRESETS = ['weekend', 'threeDays', 'oneWeek', 'twoWeeks'] as const;
type Preset = (typeof PRESETS)[number];

const PRESET_LENGTHS: Record<Exclude<Preset, 'weekend'>, number> = {
  threeDays: 3,
  oneWeek: 7,
  twoWeeks: 14,
};

const FRIDAY = 4;

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
  };
}

function readStoredSearch(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSearch(draft: SearchDraft | null): void {
  try {
    if (draft === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }
  } catch {
    // Stockage indisponible (navigation privée, quota) : la recherche fonctionne sans mémoire.
  }
}

function subscribeToNothing(): () => void {
  return () => undefined;
}

/** Dernière recherche mémorisée, sans les dates déjà passées. */
function parseStoredSearch(raw: string | null, today: string | null): SearchDraft | null {
  if (raw === null || today === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const { location, pickup, dropoff } = value as Partial<Record<keyof SearchDraft, unknown>>;
    const validPickup = typeof pickup === 'string' && ISO_DATE.test(pickup) && pickup >= today;
    const validDropoff =
      validPickup && typeof dropoff === 'string' && ISO_DATE.test(dropoff) && dropoff >= pickup;
    return {
      location: typeof location === 'string' && LOCATIONS.has(location) ? location : '',
      pickup: validPickup ? pickup : '',
      dropoff: validDropoff ? dropoff : '',
    };
  } catch {
    return null;
  }
}

function presetRange(preset: Preset, pickup: string, today: string): [string, string] {
  if (preset === 'weekend') {
    const friday = addDays(today, (FRIDAY - isoWeekday(today) + 7) % 7);
    return [friday, addDays(friday, 2)];
  }
  const start = pickup !== '' && pickup >= today ? pickup : addDays(today, 1);
  return [start, addDays(start, PRESET_LENGTHS[preset])];
}

function SearchField({
  id,
  icon: Icon,
  label,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </Label>
      {children}
    </div>
  );
}

export function HeroSearch() {
  const t = useTranslations('client.home');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const today = useSyncExternalStore(
    subscribeToNothing,
    () => todayKey(),
    () => null,
  );
  const stored = useSyncExternalStore(subscribeToStorage, readStoredSearch, () => null);
  const [draft, setDraft] = useState<SearchDraft | null>(null);
  const { location, pickup, dropoff } = draft ?? parseStoredSearch(stored, today) ?? EMPTY_DRAFT;

  const dayFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const update = (patch: Partial<SearchDraft>) => {
    setDraft({ location, pickup, dropoff, ...patch });
  };

  const days = rentalDays(pickup, dropoff);
  const hasValues = location !== '' || pickup !== '' || dropoff !== '';

  let summary: string;
  if (days !== null) {
    summary = t('search.duration', {
      from: dayFormat.format(dayKeyToDate(pickup)),
      to: dayFormat.format(dayKeyToDate(dropoff)),
      count: days,
    });
  } else if (pickup !== '') {
    summary = t('search.chooseReturn');
  } else {
    summary = t('search.datesOptional');
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        storeSearch({ location, pickup, dropoff });
        router.push(buildSearchHref({ location, pickup, dropoff }));
      }}
      aria-label={t('search.label')}
      className="grid grid-cols-2 gap-3 rounded-panel border border-border/80 bg-surface/90 p-3 shadow-elevated ring-1 ring-black/[0.02] backdrop-blur-xl sm:gap-4 sm:p-5"
    >
      <SearchField
        id={`${id}-location`}
        icon={MapPin}
        label={t('search.location')}
        className="col-span-2"
      >
        <Select
          name="location"
          value={location}
          onValueChange={(value) => {
            update({ location: value });
          }}
        >
          <SelectTrigger id={`${id}-location`} className="h-12 bg-background/60">
            <SelectValue placeholder={t('search.locationPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('search.airports')}</SelectLabel>
              {AIRPORTS.map((airport) => (
                <SelectItem key={airport.id} value={airport.slug}>
                  {t(`places.${airport.id}`)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>{t('search.cities')}</SelectLabel>
              {CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  {t(`places.${city}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SearchField>

      <SearchField id={`${id}-pickup`} icon={CalendarDays} label={t('search.pickupDate')}>
        <input
          id={`${id}-pickup`}
          name="pickupDate"
          type="date"
          value={pickup}
          min={today ?? undefined}
          aria-describedby={`${id}-summary`}
          onChange={(event) => {
            const value = event.target.value;
            update({ pickup: value, dropoff: dropoff !== '' && value > dropoff ? '' : dropoff });
          }}
          className={cn(inputClassName, 'h-12 bg-background/60')}
        />
      </SearchField>

      <SearchField id={`${id}-return`} icon={CalendarDays} label={t('search.returnDate')}>
        <input
          id={`${id}-return`}
          name="returnDate"
          type="date"
          value={dropoff}
          min={pickup !== '' ? pickup : (today ?? undefined)}
          aria-describedby={`${id}-summary`}
          onChange={(event) => {
            update({ dropoff: event.target.value });
          }}
          className={cn(inputClassName, 'h-12 bg-background/60')}
        />
      </SearchField>

      <div className="col-span-2 grid gap-2">
        <div role="group" aria-label={t('search.quickDates')} className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const range = today === null ? null : presetRange(preset, pickup, today);
            const active = range !== null && range[0] === pickup && range[1] === dropoff;
            return (
              <button
                key={preset}
                type="button"
                disabled={range === null}
                aria-pressed={active}
                onClick={() => {
                  if (range !== null) {
                    update({ pickup: range[0], dropoff: range[1] });
                  }
                }}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background/60 text-foreground hover:border-primary/40 hover:bg-primary/5',
                )}
              >
                {t(`search.presets.${preset}`)}
              </button>
            );
          })}
        </div>
        <div className="flex min-h-6 items-center justify-between gap-3">
          <p
            id={`${id}-summary`}
            aria-live="polite"
            className={cn(
              'text-xs',
              days !== null ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {summary}
          </p>
          {hasValues ? (
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                storeSearch(null);
              }}
              className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
              {t('search.clear')}
            </button>
          ) : null}
        </div>
      </div>

      <Button
        type="submit"
        variant="cta"
        size="lg"
        className="h-12 text-base shadow-lg shadow-cta/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cta/30 col-span-2"
      >
        <Search aria-hidden="true" />
        {t('search.submit')}
      </Button>
    </form>
  );
}

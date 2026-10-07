'use client';

import type { LocationType } from '@drivetn/types';
import { EmptyState } from '@drivetn/ui/empty-state';
import { inputClassName } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { type LucideIcon, MapPin, MapPinOff, Plane, Search, Ship, TrainFront } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useId, useState } from 'react';

import { SectionHeading } from '@/components/home/section-heading';
import { buildSearchHref } from '@/components/search/search-href';
import { Link } from '@/i18n/navigation';

export interface GovernorateNetwork {
  code: string;
  name: string;
  locations: { slug: string; name: string; type: LocationType }[];
}

const TYPE_ICONS: Record<LocationType, LucideIcon> = {
  AIRPORT: Plane,
  CITY: MapPin,
  TRAIN_STATION: TrainFront,
  PORT: Ship,
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matches(governorate: GovernorateNetwork, query: string): boolean {
  if (query === '') {
    return true;
  }
  return [governorate.name, ...governorate.locations.map((location) => location.name)].some(
    (name) => normalize(name).includes(query),
  );
}

export function AgenciesNetwork({ network }: { network: readonly GovernorateNetwork[] }) {
  const t = useTranslations('client.agencies.network');
  const id = useId();
  const [query, setQuery] = useState('');
  const deferredQuery = normalize(useDeferredValue(query));
  const visible = network.filter((governorate) => matches(governorate, deferredQuery));

  return (
    <section aria-labelledby="network-title" className="container py-16 sm:py-20">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          id="network-title"
          align="start"
          eyebrow={t('eyebrow')}
          title={t('title')}
          text={t('text')}
        />
        {network.length > 0 && (
          <div className="grid w-full gap-1.5 lg:max-w-sm">
            <label htmlFor={`${id}-filter`} className="text-sm font-medium">
              {t('filterLabel')}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id={`${id}-filter`}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder={t('filterPlaceholder')}
                className={cn(inputClassName, 'h-12 ps-10')}
              />
            </div>
          </div>
        )}
      </div>

      {network.length === 0 ? (
        <EmptyState
          icon={MapPinOff}
          title={t('unavailableTitle')}
          description={t('unavailableText')}
          className="mt-10 bg-surface"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MapPinOff}
          title={t('noResults', { query })}
          className="mt-10 bg-surface"
        />
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((governorate) => (
            <li
              key={governorate.code}
              className={cn(
                'group grid content-start gap-4 rounded-panel border border-border bg-surface p-5 shadow-soft transition-[border-color,box-shadow] duration-300',
                governorate.locations.length > 0
                  ? 'hover:border-primary/30 hover:shadow-elevated'
                  : 'bg-surface-muted/40',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  dir="ltr"
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold',
                    governorate.locations.length > 0
                      ? 'bg-primary-soft text-primary-soft-foreground'
                      : 'bg-surface-muted text-muted-foreground',
                  )}
                >
                  {governorate.code}
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <h3 className="truncate text-base font-bold">{governorate.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('points', { count: governorate.locations.length })}
                  </p>
                </div>
              </div>

              {governorate.locations.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {governorate.locations.map((location) => {
                    const Icon = TYPE_ICONS[location.type];
                    return (
                      <li key={location.slug}>
                        <Link
                          href={buildSearchHref({ location: location.slug })}
                          aria-label={t('searchIn', { name: location.name })}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Icon
                            className={cn(
                              'size-3.5 shrink-0 text-primary',
                              location.type === 'AIRPORT' && 'rtl:-scale-x-100',
                            )}
                            aria-hidden="true"
                          />
                          {location.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('soon')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

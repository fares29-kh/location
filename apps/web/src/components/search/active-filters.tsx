'use client';

import { formatMillimes } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useCategoryLabel } from '../vehicle-categories';
import { type ActiveFilter, listActiveFilters, type OfferFilters, removeFilter } from './catalog';

export function activeFilterKey(filter: ActiveFilter): string {
  return 'value' in filter ? `${filter.kind}-${filter.value}` : filter.kind;
}

/** Libellé court d'un critère actif (pastilles, suggestions). */
export function useActiveFilterLabel(): (filter: ActiveFilter) => string {
  const t = useTranslations('client.search');
  const tCatalog = useTranslations('client.catalog');
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();

  return (filter) => {
    switch (filter.kind) {
      case 'category':
        return categoryLabel(filter.value);
      case 'brand':
        return t('filters.allModels', { brand: filter.value });
      case 'model':
        return filter.value;
      case 'transmission':
        return tCatalog(`transmission.${filter.value}`);
      case 'fuel':
        return tCatalog(`fuel.${filter.value}`);
      case 'seats':
        return t('filters.minSeats', { count: filter.value });
      case 'price':
        return `${t('filters.upTo')} ${formatMillimes(filter.value, locale)}`;
      case 'mileage':
        return t('offer.unlimitedMileage');
      case 'instant':
        return t('offer.instant');
    }
  };
}

export function ActiveFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: OfferFilters;
  onChange: (filters: OfferFilters) => void;
  onReset: () => void;
}) {
  const t = useTranslations('client.search.filters');
  const label = useActiveFilterLabel();
  const active = listActiveFilters(filters);

  if (active.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={t('activeLabel')} className="flex flex-wrap gap-2">
        {active.map((filter) => {
          const text = label(filter);
          return (
            <li key={activeFilterKey(filter)}>
              <button
                type="button"
                aria-label={t('remove', { label: text })}
                onClick={() => {
                  onChange(removeFilter(filters, filter));
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft pe-2 ps-3 text-sm font-medium text-primary-soft-foreground transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {text}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="link" size="sm" onClick={onReset}>
        {t('clearAll')}
      </Button>
    </div>
  );
}

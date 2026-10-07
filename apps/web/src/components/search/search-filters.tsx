'use client';

import { Checkbox } from '@drivetn/ui/checkbox';
import { Label } from '@drivetn/ui/label';
import { cn } from '@drivetn/ui/lib/cn';
import { Money } from '@drivetn/ui/money';
import { RadioGroup, RadioGroupItem } from '@drivetn/ui/radio-group';
import { Switch } from '@drivetn/ui/switch';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useId } from 'react';

import {
  type OfferFilters,
  PRICE_CAPS,
  type PriceCap,
  TRANSMISSIONS,
  VEHICLE_CATEGORIES,
  type VehicleCategory,
} from './catalog';

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-b border-border pb-5 last:border-b-0 last:pb-0">
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

const optionRowClass =
  'flex min-h-touch cursor-pointer items-center gap-3 rounded-control px-2 text-sm transition-colors hover:bg-surface-muted';

export function SearchFilters({
  filters,
  onChange,
  categoryCounts,
  className,
}: {
  filters: OfferFilters;
  onChange: (filters: OfferFilters) => void;
  categoryCounts: Record<VehicleCategory, number>;
  className?: string;
}) {
  const t = useTranslations('client.search.filters');
  const tCatalog = useTranslations('client.catalog');
  const locale = useLocale();
  const id = useId();

  const toggleCategory = (category: VehicleCategory, checked: boolean) => {
    onChange({
      ...filters,
      categories: checked
        ? [...filters.categories, category]
        : filters.categories.filter((item) => item !== category),
    });
  };

  return (
    <div className={cn('grid gap-5', className)}>
      <FilterGroup title={t('category')}>
        <ul className="-mx-2 grid gap-0.5">
          {VEHICLE_CATEGORIES.map((category) => {
            const inputId = `${id}-category-${category}`;
            return (
              <li key={category}>
                <label htmlFor={inputId} className={optionRowClass}>
                  <Checkbox
                    id={inputId}
                    checked={filters.categories.includes(category)}
                    onCheckedChange={(checked) => {
                      toggleCategory(category, checked === true);
                    }}
                  />
                  <span className="flex-1">{tCatalog(`categories.${category}`)}</span>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {categoryCounts[category]}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup title={t('transmission')}>
        <RadioGroup
          value={filters.transmission}
          onValueChange={(value) => {
            const transmission = TRANSMISSIONS.find((item) => item === value) ?? 'ALL';
            onChange({ ...filters, transmission });
          }}
          className="-mx-2 gap-0.5"
        >
          {(['ALL', ...TRANSMISSIONS] as const).map((value) => {
            const inputId = `${id}-transmission-${value}`;
            return (
              <label key={value} htmlFor={inputId} className={optionRowClass}>
                <RadioGroupItem id={inputId} value={value} />
                {value === 'ALL' ? t('allTransmissions') : tCatalog(`transmission.${value}`)}
              </label>
            );
          })}
        </RadioGroup>
      </FilterGroup>

      <FilterGroup title={t('maxPrice')}>
        <div className="flex flex-wrap gap-2">
          {PRICE_CAPS.map((cap: PriceCap) => {
            const active = filters.priceCap === cap;
            return (
              <button
                key={cap ?? 'any'}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onChange({ ...filters, priceCap: cap });
                }}
                className={cn(
                  'h-9 rounded-full border px-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-surface text-foreground hover:border-primary/40 hover:bg-surface-muted',
                )}
              >
                {cap === null ? (
                  t('anyPrice')
                ) : (
                  <>
                    {t('upTo')} <Money millimes={cap} locale={locale} />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title={t('mileage')}>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-mileage`} className="text-sm font-normal">
            {t('unlimitedMileage')}
          </Label>
          <Switch
            id={`${id}-mileage`}
            checked={filters.unlimitedMileageOnly}
            onCheckedChange={(checked) => {
              onChange({ ...filters, unlimitedMileageOnly: checked });
            }}
          />
        </div>
      </FilterGroup>
    </div>
  );
}

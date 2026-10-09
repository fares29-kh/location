'use client';

import { FUEL_TYPES } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Checkbox } from '@drivetn/ui/checkbox';
import { cn } from '@drivetn/ui/lib/cn';
import { Money } from '@drivetn/ui/money';
import { RadioGroup, RadioGroupItem } from '@drivetn/ui/radio-group';
import { Switch } from '@drivetn/ui/switch';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';

import { useCategoryLabel, useVehicleCategories } from '../vehicle-categories';
import {
  type BrandGroup,
  type OfferFilters,
  PRICE_CAPS,
  SEAT_OPTIONS,
  toggleBrand,
  toggleModel,
  TRANSMISSIONS,
} from './catalog';

/** Nombre d'offres obtenues si l'on applique `patch` aux filtres courants. */
export type CountWith = (patch: Partial<OfferFilters>) => number;

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
const disabledRowClass = 'cursor-not-allowed text-muted-foreground opacity-60 hover:bg-transparent';

function CountBadge({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  count,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  count: number;
  onCheckedChange: (checked: boolean) => void;
}) {
  const disabled = count === 0 && !checked;
  return (
    <li>
      <label htmlFor={id} className={cn(optionRowClass, disabled && disabledRowClass)}>
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => {
            onCheckedChange(value === true);
          }}
        />
        <span className="flex-1">{label}</span>
        <CountBadge count={count} />
      </label>
    </li>
  );
}

function PillButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={count === 0 && !active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-surface text-foreground enabled:hover:border-primary/40 enabled:hover:bg-surface-muted',
      )}
    >
      {children}
      <span
        className={cn(
          'text-xs tabular-nums',
          active ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  count,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  count: number;
  onCheckedChange: (checked: boolean) => void;
}) {
  const disabled = count === 0 && !checked;
  return (
    <div className={cn('flex items-center justify-between gap-3', disabled && 'opacity-60')}>
      <label htmlFor={id} className="grid min-w-0 gap-0.5 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {label}
          <CountBadge count={count} />
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Nombre de marques affichées avant « Voir toutes les marques ». */
const BRANDS_PREVIEW = 6;

function BrandModelFilter({
  groups,
  filters,
  onChange,
  countWith,
}: {
  groups: readonly BrandGroup[];
  filters: OfferFilters;
  onChange: (filters: OfferFilters) => void;
  countWith: CountWith;
}) {
  const t = useTranslations('client.search.filters');
  const id = useId();
  const isSelected = (group: BrandGroup) =>
    filters.brands.includes(group.brand) ||
    group.models.some((model) => filters.models.includes(model.key));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(groups.filter(isSelected).map((group) => group.brand)),
  );
  const [showAll, setShowAll] = useState(() => groups.findIndex(isSelected) >= BRANDS_PREVIEW);
  const visible = showAll ? groups : groups.slice(0, BRANDS_PREVIEW);

  const setOpen = (brand: string, open: boolean) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) {
        next.add(brand);
      } else {
        next.delete(brand);
      }
      return next;
    });
  };

  return (
    <div className="grid gap-1">
      <ul className="-mx-2 grid gap-0.5">
        {visible.map((group, index) => {
          const brandChecked = filters.brands.includes(group.brand);
          const partial =
            !brandChecked && group.models.some((model) => filters.models.includes(model.key));
          const count = countWith({ brands: [group.brand], models: [] });
          const disabled = count === 0 && !brandChecked && !partial;
          const open = expanded.has(group.brand);
          const inputId = `${id}-brand-${index}`;
          const listId = `${id}-models-${index}`;
          return (
            <li key={group.brand}>
              <div className="flex items-center gap-1">
                <label
                  htmlFor={inputId}
                  className={cn(optionRowClass, 'flex-1', disabled && disabledRowClass)}
                >
                  <Checkbox
                    id={inputId}
                    checked={brandChecked ? true : partial ? 'indeterminate' : false}
                    disabled={disabled}
                    onCheckedChange={(value) => {
                      const checked = value === true;
                      onChange(toggleBrand(filters, group, checked));
                      if (checked) {
                        setOpen(group.brand, true);
                      }
                    }}
                  />
                  <span className="flex-1 font-medium">{group.brand}</span>
                  <CountBadge count={count} />
                </label>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-label={t('showModels', { brand: group.brand })}
                  onClick={() => {
                    setOpen(group.brand, !open);
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown
                    className={cn('size-4 transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
              </div>
              {open && (
                <ul
                  id={listId}
                  aria-label={group.brand}
                  className="mb-1 ms-[1.125rem] grid gap-0.5 border-s border-border ps-2"
                >
                  {group.models.map((model, modelIndex) => (
                    <CheckboxRow
                      key={model.key}
                      id={`${listId}-${modelIndex}`}
                      label={model.name}
                      checked={brandChecked || filters.models.includes(model.key)}
                      count={countWith({ brands: [], models: [model.key] })}
                      onCheckedChange={(checked) => {
                        onChange(toggleModel(filters, group, model.key, checked));
                      }}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {groups.length > BRANDS_PREVIEW && (
        <Button
          variant="link"
          size="sm"
          className="justify-self-start px-0"
          onClick={() => {
            setShowAll((current) => !current);
          }}
        >
          {showAll ? t('showLessBrands') : t('showAllBrands', { count: groups.length })}
        </Button>
      )}
    </div>
  );
}

export function SearchFilters({
  filters,
  onChange,
  countWith,
  brands,
  className,
}: {
  filters: OfferFilters;
  onChange: (filters: OfferFilters) => void;
  countWith: CountWith;
  /** Marques et modèles des véhicules proposés dans les offres. */
  brands: readonly BrandGroup[];
  className?: string;
}) {
  const t = useTranslations('client.search.filters');
  const tCatalog = useTranslations('client.catalog');
  const categories = useVehicleCategories();
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const id = useId();

  const toggle = <T,>(list: readonly T[], value: T, checked: boolean): T[] =>
    checked ? [...list, value] : list.filter((item) => item !== value);

  return (
    <div className={cn('grid gap-5', className)}>
      <FilterGroup title={t('category')}>
        <ul className="-mx-2 grid gap-0.5">
          {categories.map(({ slug: category }) => (
            <CheckboxRow
              key={category}
              id={`${id}-category-${category}`}
              label={categoryLabel(category)}
              checked={filters.categories.includes(category)}
              count={countWith({ categories: [category] })}
              onCheckedChange={(checked) => {
                onChange({ ...filters, categories: toggle(filters.categories, category, checked) });
              }}
            />
          ))}
        </ul>
      </FilterGroup>

      {brands.length > 0 && (
        <FilterGroup title={t('brandModel')}>
          <BrandModelFilter
            groups={brands}
            filters={filters}
            onChange={onChange}
            countWith={countWith}
          />
        </FilterGroup>
      )}

      <FilterGroup title={t('maxPrice')}>
        <div className="flex flex-wrap gap-2">
          {PRICE_CAPS.map((cap) => (
            <PillButton
              key={cap ?? 'any'}
              active={filters.priceCap === cap}
              count={countWith({ priceCap: cap })}
              onClick={() => {
                onChange({ ...filters, priceCap: cap });
              }}
            >
              {cap === null ? (
                t('anyPrice')
              ) : (
                <span>
                  {t('upTo')} <Money millimes={cap} locale={locale} />
                </span>
              )}
            </PillButton>
          ))}
        </div>
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
            const count = countWith({ transmission: value });
            const disabled = count === 0 && filters.transmission !== value;
            return (
              <label
                key={value}
                htmlFor={inputId}
                className={cn(optionRowClass, disabled && disabledRowClass)}
              >
                <RadioGroupItem id={inputId} value={value} disabled={disabled} />
                <span className="flex-1">
                  {value === 'ALL' ? t('allTransmissions') : tCatalog(`transmission.${value}`)}
                </span>
                <CountBadge count={count} />
              </label>
            );
          })}
        </RadioGroup>
      </FilterGroup>

      <FilterGroup title={t('seats')}>
        <div className="flex flex-wrap gap-2">
          {SEAT_OPTIONS.map((seats) => (
            <PillButton
              key={seats ?? 'any'}
              active={filters.minSeats === seats}
              count={countWith({ minSeats: seats })}
              onClick={() => {
                onChange({ ...filters, minSeats: seats });
              }}
            >
              {seats === null ? t('anySeats') : t('minSeats', { count: seats })}
            </PillButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={t('fuel')}>
        <ul className="-mx-2 grid gap-0.5">
          {FUEL_TYPES.map((fuel) => (
            <CheckboxRow
              key={fuel}
              id={`${id}-fuel-${fuel}`}
              label={tCatalog(`fuel.${fuel}`)}
              checked={filters.fuels.includes(fuel)}
              count={countWith({ fuels: [fuel] })}
              onCheckedChange={(checked) => {
                onChange({ ...filters, fuels: toggle(filters.fuels, fuel, checked) });
              }}
            />
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title={t('conditions')}>
        <div className="grid gap-4">
          <SwitchRow
            id={`${id}-mileage`}
            label={t('unlimitedMileage')}
            hint={t('unlimitedMileageHint')}
            checked={filters.unlimitedMileageOnly}
            count={countWith({ unlimitedMileageOnly: true })}
            onCheckedChange={(checked) => {
              onChange({ ...filters, unlimitedMileageOnly: checked });
            }}
          />
          <SwitchRow
            id={`${id}-instant`}
            label={t('instant')}
            hint={t('instantHint')}
            checked={filters.instantOnly}
            count={countWith({ instantOnly: true })}
            onCheckedChange={(checked) => {
              onChange({ ...filters, instantOnly: checked });
            }}
          />
        </div>
      </FilterGroup>
    </div>
  );
}

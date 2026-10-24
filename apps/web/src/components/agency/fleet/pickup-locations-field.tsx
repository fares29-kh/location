'use client';

import {
  governorateSchema,
  locationSchema,
  pickLocalized,
  VEHICLE_PICKUP_LOCATIONS_MAX,
} from '@drivetn/types';
import { Combobox } from '@drivetn/ui/combobox';
import { cn } from '@drivetn/ui/lib/cn';
import { useQuery } from '@tanstack/react-query';
import { MapPin, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export interface PickupPlaceOption {
  slug: string;
  label: string;
  governorate: string;
  keywords: string;
}

export function usePickupPlaces() {
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['reference', 'pickup-places'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [governorates, locations] = await Promise.all([
        apiFetch('/locations/governorates', { schema: z.array(governorateSchema) }),
        apiFetch('/locations', { schema: z.array(locationSchema) }),
      ]);
      return { governorates, locations };
    },
  });

  const places = useMemo<PickupPlaceOption[]>(() => {
    const rows = query.data;
    if (rows === undefined) {
      return [];
    }
    const governorateName = new Map(
      rows.governorates.map((governorate) => [
        governorate.code,
        pickLocalized(governorate.name, locale),
      ]),
    );
    return rows.locations
      .map((location) => {
        const governorate = governorateName.get(location.governorateCode) ?? '';
        const label = pickLocalized(location.name, locale);
        return {
          slug: location.slug,
          label,
          governorate,
          keywords: [governorate, location.iataCode ?? '', location.type].join(' '),
        };
      })
      .sort(
        (a, b) =>
          a.governorate.localeCompare(b.governorate, locale) ||
          a.label.localeCompare(b.label, locale),
      );
  }, [locale, query.data]);

  return { places, isPending: query.isPending, isError: query.isError };
}

export function PickupLocationsField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: readonly string[];
  onChange: (slugs: string[]) => void;
  error?: string;
}) {
  const t = useTranslations('agency.fleet.form');
  const { places, isPending, isError } = usePickupPlaces();
  const bySlug = new Map(places.map((place) => [place.slug, place]));
  const selected = value.map(
    (slug) => bySlug.get(slug) ?? { slug, label: slug, governorate: '', keywords: '' },
  );
  const remaining = places.filter((place) => !value.includes(place.slug));

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{t('places')}</p>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t('placesHint')}
      </p>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((place) => (
            <li key={place.slug}>
              <button
                type="button"
                onClick={() => {
                  onChange(value.filter((slug) => slug !== place.slug));
                }}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-muted py-1 pe-2 ps-2.5 text-sm"
              >
                <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">
                  {place.governorate.length > 0
                    ? `${place.label} · ${place.governorate}`
                    : place.label}
                </span>
                <X className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">{t('placesRemove', { place: place.label })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Combobox
        id={id}
        value=""
        disabled={isPending || isError || value.length >= VEHICLE_PICKUP_LOCATIONS_MAX}
        onValueChange={(slug) => {
          if (slug.length > 0 && !value.includes(slug)) {
            onChange([...value, slug]);
          }
        }}
        options={remaining.map((place) => ({
          value: place.slug,
          label:
            place.governorate.length > 0 ? `${place.label} · ${place.governorate}` : place.label,
          keywords: place.keywords,
        }))}
        placeholder={t('placesPlaceholder')}
        searchPlaceholder={t('placesSearch')}
        emptyText={t('placesEmpty')}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? `${id}-hint` : `${id}-error`}
        className={cn(error !== undefined && 'border-danger')}
      />
      {isPending && (
        <p className="text-xs text-muted-foreground" role="status">
          {t('placesLoading')}
        </p>
      )}
      {isError && <p className="text-sm text-danger">{t('placesError')}</p>}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

import { type LocationType, pickLocalized } from '@drivetn/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AIRPORTS, CITIES } from '@/components/home/places';
import { isVehicleCategory } from '@/components/search/catalog';
import type { LocationOption } from '@/components/search/search-form';
import { SearchView } from '@/components/search/search-view';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { fetchPickupLocations } from '@/lib/locations';

interface SearchPageProps extends LocaleParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TYPE_ORDER: readonly LocationType[] = ['AIRPORT', 'CITY', 'TRAIN_STATION', 'PORT'];

function firstValue(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first.length === 0 ? null : first;
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({
    locale: await resolveLocale(params),
    namespace: 'client.search',
  });
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const locale = await resolveLocale(params);
  const [query, locations, t] = await Promise.all([
    searchParams,
    fetchPickupLocations(),
    getTranslations({ locale, namespace: 'client.home.places' }),
  ]);

  // Sans API, on retombe sur les lieux mis en avant sur l'accueil.
  const options: LocationOption[] =
    locations.length > 0
      ? [...locations]
          .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
          .map((location) => ({
            value: location.slug,
            label: pickLocalized(location.name, locale),
            type: location.type,
          }))
      : [
          ...AIRPORTS.map((airport) => ({
            value: airport.slug,
            label: t(airport.id),
            type: 'AIRPORT' as const,
          })),
          ...CITIES.map((city) => ({ value: city, label: t(city), type: 'CITY' as const })),
        ];

  const location = firstValue(query.location);
  const category = firstValue(query.category);

  return (
    <SearchView
      locationOptions={options}
      initialLocation={options.some((option) => option.value === location) ? location : null}
      initialPickup={firstValue(query.pickup)}
      initialReturn={firstValue(query.return)}
      initialCategory={isVehicleCategory(category) ? category : null}
    />
  );
}

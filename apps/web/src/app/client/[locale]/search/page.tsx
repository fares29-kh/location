import { type LocationType, pickLocalized, todayKey } from '@drivetn/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AIRPORTS, CITIES, fallbackGovernorates } from '@/components/home/places';
import { bookableDates, parseSearchFilters, toSearchOffer } from '@/components/search/catalog';
import type { GovernorateOption, LocationOption } from '@/components/search/search-form';
import { SearchView } from '@/components/search/search-view';
import { getPortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { fetchGovernorates, fetchPickupLocations } from '@/lib/locations';
import { fetchOffers } from '@/lib/offers';

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
  const [query, locations, governorates, user, t] = await Promise.all([
    searchParams,
    fetchPickupLocations(),
    fetchGovernorates(),
    getPortalUser('client'),
    getTranslations({ locale, namespace: 'client.home.places' }),
  ]);

  const governorateOptions: GovernorateOption[] = (
    governorates.length > 0
      ? governorates.map((governorate) => ({
          code: governorate.code,
          label: pickLocalized(governorate.name, locale),
        }))
      : fallbackGovernorates(locale)
  ).sort((a, b) => a.label.localeCompare(b.label, locale));

  // Sans API, on retombe sur les lieux mis en avant sur l'accueil.
  const options: LocationOption[] =
    locations.length > 0
      ? [...locations]
          .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
          .map((location) => ({
            value: location.slug,
            label: pickLocalized(location.name, locale),
            type: location.type,
            governorateCode: location.governorateCode,
          }))
      : [
          ...AIRPORTS.map((airport) => ({
            value: airport.slug,
            label: t(airport.id),
            type: 'AIRPORT' as const,
          })),
          ...CITIES.map((city) => ({ value: city, label: t(city), type: 'CITY' as const })),
        ];

  const requestedLocation = firstValue(query.location);
  const selectedLocation = options.find((option) => option.value === requestedLocation);
  const location = selectedLocation?.value ?? null;
  // Un lieu précis impose son gouvernorat.
  const requestedGovernorate = selectedLocation?.governorateCode ?? firstValue(query.governorate);
  const governorate =
    governorateOptions.find((option) => option.code === requestedGovernorate)?.code ?? null;
  const pickup = firstValue(query.pickup);
  const dropoff = firstValue(query.return);
  const dates = bookableDates(pickup, dropoff, todayKey());
  const { filters, sort } = parseSearchFilters((key) => firstValue(query[key]));
  const result = await fetchOffers({
    location,
    governorate,
    pickup: dates?.pickup ?? null,
    dropoff: dates?.dropoff ?? null,
  });

  return (
    <SearchView
      locationOptions={options}
      governorateOptions={governorateOptions}
      initialGovernorate={governorate}
      initialLocation={location}
      initialPickup={pickup}
      initialReturn={dropoff}
      initialFilters={filters}
      initialSort={sort}
      initialBooking={firstValue(query.book)}
      offers={result === null ? null : result.offers.map(toSearchOffer)}
      dates={dates}
      signedIn={user !== null}
    />
  );
}

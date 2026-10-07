import { type LocationType, pickLocalized, todayKey } from '@drivetn/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AIRPORTS, CITIES } from '@/components/home/places';
import { bookableDates, isVehicleCategory, toSearchOffer } from '@/components/search/catalog';
import type { LocationOption } from '@/components/search/search-form';
import { SearchView } from '@/components/search/search-view';
import { getPortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { fetchPickupLocations } from '@/lib/locations';
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
  const [query, locations, user, t] = await Promise.all([
    searchParams,
    fetchPickupLocations(),
    getPortalUser('client'),
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
  const location = options.some((option) => option.value === requestedLocation)
    ? requestedLocation
    : null;
  const pickup = firstValue(query.pickup);
  const dropoff = firstValue(query.return);
  const dates = bookableDates(pickup, dropoff, todayKey());
  const category = firstValue(query.category);
  const result = await fetchOffers({
    location,
    pickup: dates?.pickup ?? null,
    dropoff: dates?.dropoff ?? null,
  });

  return (
    <SearchView
      locationOptions={options}
      initialLocation={location}
      initialPickup={pickup}
      initialReturn={dropoff}
      initialCategory={isVehicleCategory(category) ? category : null}
      initialBooking={firstValue(query.book)}
      offers={result === null ? null : result.offers.map(toSearchOffer)}
      dates={dates}
      signedIn={user !== null}
    />
  );
}

import { type LocationType, pickLocalized } from '@drivetn/types';

import { fallbackGovernorates } from '@/components/home/places';
import { ClientHome } from '@/components/pages/client-home';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { fetchGovernorates, fetchPickupLocations } from '@/lib/locations';
import { getPortalOrigin } from '@/lib/portal-origin';
import { fetchVehicleCategories } from '@/lib/vehicle-catalog';

const TYPE_ORDER: readonly LocationType[] = ['AIRPORT', 'CITY', 'TRAIN_STATION', 'PORT'];

export default async function ClientHomePage({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const [agencyUrl, categories, governorates, locations] = await Promise.all([
    getPortalOrigin('agency'),
    fetchVehicleCategories(),
    fetchGovernorates(),
    fetchPickupLocations(),
  ]);
  const governorateOptions = (
    governorates.length > 0
      ? governorates.map((governorate) => ({
          code: governorate.code,
          label: pickLocalized(governorate.name, locale),
        }))
      : fallbackGovernorates(locale)
  ).sort((a, b) => a.label.localeCompare(b.label, locale));
  const governorateName = new Map(governorateOptions.map((option) => [option.code, option.label]));
  const places = [...locations]
    .sort(
      (a, b) =>
        TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
        pickLocalized(a.name, locale).localeCompare(pickLocalized(b.name, locale), locale),
    )
    .map((location) => ({
      slug: location.slug,
      label: pickLocalized(location.name, locale),
      type: location.type,
      governorateCode: location.governorateCode,
      keywords: [location.iataCode, governorateName.get(location.governorateCode)]
        .filter((part) => part !== undefined && part !== null && part.length > 0)
        .join(' '),
    }));

  return (
    <ClientHome
      agencyUrl={agencyUrl}
      categories={categories}
      governorates={governorateOptions}
      places={places}
    />
  );
}

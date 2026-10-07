import { pickLocalized } from '@drivetn/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AgenciesCharter } from '@/components/agencies/agencies-charter';
import { type GovernorateNetwork, AgenciesNetwork } from '@/components/agencies/agencies-network';
import { AgenciesHero } from '@/components/agencies/agencies-hero';
import { AgencyCta } from '@/components/home/agency-cta';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { fetchGovernorates, fetchPickupLocations } from '@/lib/locations';
import { getPortalOrigin } from '@/lib/portal-origin';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const t = await getTranslations({
    locale: await resolveLocale(params),
    namespace: 'client.agencies',
  });
  return { title: t('metaTitle'), description: t('subtitle') };
}

export default async function AgenciesPage({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const [governorates, locations, agencyUrl] = await Promise.all([
    fetchGovernorates(),
    fetchPickupLocations(),
    getPortalOrigin('agency'),
  ]);

  const network: GovernorateNetwork[] = governorates.map((governorate) => ({
    code: governorate.code,
    name: pickLocalized(governorate.name, locale),
    locations: locations
      .filter((location) => location.governorateCode === governorate.code)
      .map((location) => ({
        slug: location.slug,
        name: pickLocalized(location.name, locale),
        type: location.type,
      })),
  }));

  return (
    <>
      <AgenciesHero
        governorates={governorates.length}
        airports={locations.filter((location) => location.type === 'AIRPORT').length}
        pickupPoints={locations.length}
      />
      <AgenciesNetwork network={network} />
      <AgenciesCharter />
      <AgencyCta agencyUrl={agencyUrl} />
    </>
  );
}

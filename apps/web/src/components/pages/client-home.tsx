import type { VehicleCategoryInfo } from '@drivetn/types';

import { AgencyCta } from '@/components/home/agency-cta';
import { HomeAirports } from '@/components/home/home-airports';
import { HomeCategories } from '@/components/home/home-categories';
import { HomeFaq } from '@/components/home/home-faq';
import { HomeFeatures } from '@/components/home/home-features';
import { type HeroGovernorate, type HeroPlace } from '@/components/home/hero-search';
import { HomeHero } from '@/components/home/home-hero';
import { HowItWorks } from '@/components/home/how-it-works';

export function ClientHome({
  agencyUrl,
  categories,
  governorates,
  places,
}: {
  agencyUrl: string;
  categories: readonly VehicleCategoryInfo[];
  governorates: readonly HeroGovernorate[];
  places: readonly HeroPlace[];
}) {
  return (
    <>
      <HomeHero governorates={governorates} places={places} />
      <HomeCategories categories={categories} />
      <HowItWorks />
      <HomeFeatures />
      <HomeAirports />
      <HomeFaq />
      <AgencyCta agencyUrl={agencyUrl} />
    </>
  );
}

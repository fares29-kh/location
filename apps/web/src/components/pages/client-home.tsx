import { AgencyCta } from '@/components/home/agency-cta';
import { HomeAirports } from '@/components/home/home-airports';
import { HomeCategories } from '@/components/home/home-categories';
import { HomeFaq } from '@/components/home/home-faq';
import { HomeFeatures } from '@/components/home/home-features';
import { HomeHero } from '@/components/home/home-hero';
import { HowItWorks } from '@/components/home/how-it-works';

export function ClientHome({ agencyUrl }: { agencyUrl: string }) {
  return (
    <>
      <HomeHero />
      <HomeCategories />
      <HowItWorks />
      <HomeFeatures />
      <HomeAirports />
      <HomeFaq />
      <AgencyCta agencyUrl={agencyUrl} />
    </>
  );
}

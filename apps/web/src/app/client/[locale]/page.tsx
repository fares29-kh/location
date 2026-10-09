import { ClientHome } from '@/components/pages/client-home';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { getPortalOrigin } from '@/lib/portal-origin';
import { fetchVehicleCategories } from '@/lib/vehicle-catalog';

export default async function ClientHomePage({ params }: LocaleParams) {
  await resolveLocale(params);
  const [agencyUrl, categories] = await Promise.all([
    getPortalOrigin('agency'),
    fetchVehicleCategories(),
  ]);
  return <ClientHome agencyUrl={agencyUrl} categories={categories} />;
}

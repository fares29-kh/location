import { ClientHome } from '@/components/pages/client-home';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { getPortalOrigin } from '@/lib/portal-origin';

export default async function ClientHomePage({ params }: LocaleParams) {
  await resolveLocale(params);
  return <ClientHome agencyUrl={await getPortalOrigin('agency')} />;
}

import { DashboardView } from '@/components/agency/dashboard/dashboard-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export const generateMetadata = agencyPageMetadata('dashboard');

export default async function AgencyHomePage({ params }: LocaleParams) {
  const user = await requirePortalUser('agency', await resolveLocale(params));
  return <DashboardView firstName={user.firstName} />;
}

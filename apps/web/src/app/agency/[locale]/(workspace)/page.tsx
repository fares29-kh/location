import { WorkspaceHome } from '@/components/pages/workspace-home';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export default async function AgencyHomePage({ params }: LocaleParams) {
  const user = await requirePortalUser('agency', await resolveLocale(params));
  return <WorkspaceHome portal="agency" firstName={user.firstName} />;
}

import { WorkspaceHome } from '@/components/pages/workspace-home';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export default async function AdminHomePage({ params }: LocaleParams) {
  const user = await requirePortalUser('admin', await resolveLocale(params));
  return <WorkspaceHome portal="admin" firstName={user.firstName} />;
}

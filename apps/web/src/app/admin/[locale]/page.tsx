import { WorkspaceHome } from '@/components/pages/workspace-home';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export default async function AdminHomePage({ params }: LocaleParams) {
  await resolveLocale(params);
  return <WorkspaceHome portal="admin" />;
}

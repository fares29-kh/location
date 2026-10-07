import { AdminDashboardView } from '@/components/admin/dashboard/admin-dashboard-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

export const generateMetadata = adminPageMetadata('dashboard');

export default async function AdminHomePage({ params }: LocaleParams) {
  const user = await requirePortalUser('admin', await resolveLocale(params));
  return <AdminDashboardView firstName={user.firstName} />;
}

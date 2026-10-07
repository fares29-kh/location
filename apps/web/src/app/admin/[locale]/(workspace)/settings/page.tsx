import { PlatformSettingsView } from '@/components/admin/settings/platform-settings-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('settings');

export default function AdminSettingsPage() {
  return <PlatformSettingsView />;
}

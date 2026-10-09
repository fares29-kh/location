import { GeographyView } from '@/components/admin/geography/geography-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('geography');

export default function AdminGeographyPage() {
  return <GeographyView />;
}

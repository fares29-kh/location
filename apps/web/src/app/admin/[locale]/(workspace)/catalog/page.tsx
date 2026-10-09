import { CatalogView } from '@/components/admin/catalog/catalog-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('catalog');

export default function AdminCatalogPage() {
  return <CatalogView />;
}

import type { Metadata } from 'next';

import { PortalHello } from '@/components/portal-hello';
import { PORTAL_CONFIG } from '@/lib/portal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: PORTAL_CONFIG.admin.label,
  robots: { index: false, follow: false },
};

export default function AdminHomePage() {
  return <PortalHello portal="admin" />;
}

import type { ReactNode } from 'react';

import { AuthSplitLayout } from '@/components/auth/auth-split-layout';

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplitLayout portal="admin">{children}</AuthSplitLayout>;
}

import type { ReactNode } from 'react';

import { AuthSplitLayout } from '@/components/auth/auth-split-layout';

export default function AgencyAuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplitLayout portal="agency">{children}</AuthSplitLayout>;
}

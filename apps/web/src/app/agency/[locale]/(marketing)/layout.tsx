import type { ReactNode } from 'react';

import { AgencyWelcomeHeader } from '@/components/agency/welcome/welcome-header';
import { MAIN_CONTENT_ID } from '@/components/skip-link';

export default function AgencyMarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AgencyWelcomeHeader />
      <main id={MAIN_CONTENT_ID} className="flex-1">
        {children}
      </main>
    </div>
  );
}

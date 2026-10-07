import type { Portal } from '@drivetn/types';
import { cookies } from 'next/headers';

import { sidebarCookieName } from './sidebar-preference';

export async function readSidebarCollapsed(portal: Portal): Promise<boolean> {
  return (await cookies()).get(sidebarCookieName(portal))?.value === '1';
}

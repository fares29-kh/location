'use client';

import {
  CalendarCheck,
  CalendarDays,
  CarFront,
  HandCoins,
  LayoutDashboard,
  Palette,
  Settings,
  Star,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AppShell, type ShellNavSection } from '@/components/shell/app-shell';

export function AgencyShell({
  designEnabled,
  children,
}: {
  designEnabled: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('agency.nav');
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');

  const sections: ShellNavSection[] = [
    {
      id: 'operations',
      title: t('operations'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, href: '/' },
        { id: 'bookings', label: t('bookings'), icon: CalendarCheck, href: null },
        { id: 'calendar', label: t('calendar'), icon: CalendarDays, href: null },
        { id: 'payments', label: t('payments'), icon: HandCoins, href: null },
      ],
    },
    {
      id: 'management',
      title: t('management'),
      items: [
        { id: 'fleet', label: t('fleet'), icon: CarFront, href: null },
        { id: 'customers', label: t('customers'), icon: Users, href: null },
        { id: 'reviews', label: t('reviews'), icon: Star, href: null },
        { id: 'settings', label: t('settings'), icon: Settings, href: null },
        ...(designEnabled
          ? [{ id: 'design', label: tShell('designSystem'), icon: Palette, href: '/design' }]
          : []),
      ],
    },
  ];

  return (
    <AppShell portalLabel={tCommon('portals.agency')} sections={sections}>
      {children}
    </AppShell>
  );
}

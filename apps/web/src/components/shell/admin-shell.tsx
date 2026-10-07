'use client';

import {
  Building2,
  CalendarCheck,
  LayoutDashboard,
  MessageSquareWarning,
  Palette,
  ReceiptText,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import type { CurrentUser } from '@drivetn/types';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AppShell, type ShellNavSection } from '@/components/shell/app-shell';

export function AdminShell({
  user,
  designEnabled,
  children,
}: {
  user: CurrentUser;
  designEnabled: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('admin.nav');
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');

  const sections: ShellNavSection[] = [
    {
      id: 'platform',
      title: t('platform'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, href: '/' },
        { id: 'agencies', label: t('agencies'), icon: Building2, href: null },
        { id: 'users', label: t('users'), icon: Users, href: null },
        { id: 'bookings', label: t('bookings'), icon: CalendarCheck, href: null },
        { id: 'billing', label: t('billing'), icon: ReceiptText, href: null },
        { id: 'reviews', label: t('reviews'), icon: MessageSquareWarning, href: null },
      ],
    },
    {
      id: 'system',
      title: t('system'),
      items: [
        { id: 'settings', label: t('settings'), icon: Settings, href: null },
        { id: 'audit', label: t('audit'), icon: ScrollText, href: null },
        ...(designEnabled
          ? [{ id: 'design', label: tShell('designSystem'), icon: Palette, href: '/design' }]
          : []),
      ],
    },
  ];

  return (
    <AppShell portal="admin" user={user} portalLabel={tCommon('portals.admin')} sections={sections}>
      {children}
    </AppShell>
  );
}

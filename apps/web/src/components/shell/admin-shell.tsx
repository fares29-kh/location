'use client';

import type { CurrentUser } from '@drivetn/types';
import {
  Building2,
  CalendarCheck,
  LayoutDashboard,
  MapPinned,
  MessageSquareWarning,
  Palette,
  ReceiptText,
  ScrollText,
  Settings,
  Tags,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AdminSessionProvider } from '@/components/admin/admin-session';
import { AdminNotificationsMenu } from '@/components/admin/notifications-menu';
import { AppShell, type ShellNavSection } from '@/components/shell/app-shell';
import { useAdminNavCounts } from '@/lib/admin/queries';

export function AdminShell({
  user,
  designEnabled,
  sidebarCollapsed,
  children,
}: {
  user: CurrentUser;
  designEnabled: boolean;
  sidebarCollapsed: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('admin.nav');
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');
  const { data: counts } = useAdminNavCounts();
  const pendingAgencies = counts?.pendingAgencies ?? 0;
  const flaggedReviews = counts?.flaggedReviews ?? 0;
  const overdueInvoices = counts?.overdueInvoices ?? 0;

  const sections: ShellNavSection[] = [
    {
      id: 'platform',
      title: t('platform'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, href: '/' },
        {
          id: 'agencies',
          label: t('agencies'),
          icon: Building2,
          href: '/agencies',
          count: pendingAgencies,
          countLabel: t('pendingAgencies', { count: pendingAgencies }),
        },
        { id: 'users', label: t('users'), icon: Users, href: '/users' },
        { id: 'bookings', label: t('bookings'), icon: CalendarCheck, href: '/bookings' },
        {
          id: 'billing',
          label: t('billing'),
          icon: ReceiptText,
          href: '/billing',
          count: overdueInvoices,
          countLabel: t('overdueInvoices', { count: overdueInvoices }),
        },
        {
          id: 'reviews',
          label: t('reviews'),
          icon: MessageSquareWarning,
          href: '/reviews',
          count: flaggedReviews,
          countLabel: t('flaggedReviews', { count: flaggedReviews }),
        },
      ],
    },
    {
      id: 'referentials',
      title: t('referentials'),
      items: [
        { id: 'catalog', label: t('catalog'), icon: Tags, href: '/catalog' },
        { id: 'geography', label: t('geography'), icon: MapPinned, href: '/geography' },
      ],
    },
    {
      id: 'system',
      title: t('system'),
      items: [
        { id: 'settings', label: t('settings'), icon: Settings, href: '/settings' },
        { id: 'audit', label: t('audit'), icon: ScrollText, href: '/audit' },
        ...(designEnabled
          ? [{ id: 'design', label: tShell('designSystem'), icon: Palette, href: '/design' }]
          : []),
      ],
    },
  ];

  return (
    <AdminSessionProvider user={user}>
      <AppShell
        portal="admin"
        user={user}
        portalLabel={tCommon('portals.admin')}
        sections={sections}
        defaultCollapsed={sidebarCollapsed}
        topbarActions={<AdminNotificationsMenu />}
      >
        {children}
      </AppShell>
    </AdminSessionProvider>
  );
}

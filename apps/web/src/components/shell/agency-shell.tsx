'use client';

import type { CurrentUser } from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import {
  CalendarCheck,
  CalendarDays,
  CarFront,
  HandCoins,
  Receipt,
  LayoutDashboard,
  Palette,
  Settings,
  Star,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { DemoDataBadge } from '@/components/agency/demo-data-badge';
import { NotificationsMenu } from '@/components/agency/notifications-menu';
import { AppShell, type ShellNavSection } from '@/components/shell/app-shell';
import { AGENCY_DEMO_MODE } from '@/lib/agency/api';
import { useNavCounts } from '@/lib/agency/queries';

export function AgencyShell({
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
  const t = useTranslations('agency.nav');
  const tBilling = useTranslations('agency.billing');
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');
  const { data: counts } = useNavCounts();
  const pending = counts?.pendingBookings ?? 0;
  const unanswered = counts?.unansweredReviews ?? 0;
  const billing = counts?.billing;

  const sections: ShellNavSection[] = [
    {
      id: 'operations',
      title: t('operations'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, href: '/' },
        {
          id: 'bookings',
          label: t('bookings'),
          icon: CalendarCheck,
          href: '/bookings',
          count: pending,
          countLabel: t('pendingCount', { count: pending }),
        },
        { id: 'calendar', label: t('calendar'), icon: CalendarDays, href: '/calendar' },
        { id: 'payments', label: t('payments'), icon: HandCoins, href: '/payments' },
        { id: 'expenses', label: t('expenses'), icon: Receipt, href: '/expenses' },
      ],
    },
    {
      id: 'management',
      title: t('management'),
      items: [
        { id: 'fleet', label: t('fleet'), icon: CarFront, href: '/fleet' },
        { id: 'customers', label: t('customers'), icon: Users, href: '/customers' },
        {
          id: 'reviews',
          label: t('reviews'),
          icon: Star,
          href: '/reviews',
          count: unanswered,
          countLabel: t('unansweredCount', { count: unanswered }),
        },
        { id: 'settings', label: t('settings'), icon: Settings, href: '/settings' },
        ...(designEnabled
          ? [{ id: 'design', label: tShell('designSystem'), icon: Palette, href: '/design' }]
          : []),
      ],
    },
  ];

  return (
    <AppShell
      portal="agency"
      user={user}
      portalLabel={tCommon('portals.agency')}
      sections={sections}
      defaultCollapsed={sidebarCollapsed}
      topbarActions={
        <>
          {AGENCY_DEMO_MODE && <DemoDataBadge />}
          <NotificationsMenu />
        </>
      }
    >
      {billing?.held === true && (
        <Alert tone="danger" title={tBilling('heldTitle')} className="mb-4">
          {tBilling('heldText')}
        </Alert>
      )}
      {billing?.held === false && billing.daysLeft !== null && (
        <Alert tone="info" title={tBilling('trialTitle')} className="mb-4">
          {tBilling('trialText', { days: billing.daysLeft })}
        </Alert>
      )}
      {children}
    </AppShell>
  );
}

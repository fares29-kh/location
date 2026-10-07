'use client';

import type { CurrentUser } from '@drivetn/types';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@drivetn/ui/sheet';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@drivetn/ui/sidebar';
import { Topbar, TopbarSection, TopbarSpacer } from '@drivetn/ui/topbar';
import { type LucideIcon, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { UserMenu } from '@/components/auth/user-menu';
import { BrandLogo } from '@/components/brand-logo';
import { isActivePath } from '@/components/client/client-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { MAIN_CONTENT_ID } from '@/components/skip-link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link, usePathname } from '@/i18n/navigation';

export interface ShellNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** `null` : module livré dans une phase ultérieure (affiché « Bientôt »). */
  href: string | null;
}

export interface ShellNavSection {
  id: string;
  title: string;
  items: ShellNavItem[];
}

export interface AppShellProps {
  portal: 'agency' | 'admin';
  user: CurrentUser;
  portalLabel: string;
  sections: ShellNavSection[];
  children: ReactNode;
}

function ShellNavigation({
  sections,
  onNavigate,
}: {
  sections: ShellNavSection[];
  onNavigate?: () => void;
}) {
  const t = useTranslations('common');
  const tShell = useTranslations('shell');
  const pathname = usePathname();

  return (
    <SidebarContent aria-label={tShell('navLabel')}>
      {sections.map((section) => (
        <SidebarSection key={section.id} title={section.title}>
          {section.items.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              disabled={item.href === null}
              active={item.href !== null && isActivePath(pathname, item.href)}
              badge={
                item.href === null ? <Badge className="px-2">{t('comingSoon')}</Badge> : undefined
              }
            >
              {item.href !== null && <Link href={item.href} onClick={onNavigate} />}
            </SidebarItem>
          ))}
        </SidebarSection>
      ))}
    </SidebarContent>
  );
}

/** Mise en page des espaces agence et admin : barre latérale repliable, menu mobile, barre supérieure. */
export function AppShell({ portal, user, portalLabel, sections, children }: AppShellProps) {
  const t = useTranslations('common');
  const tShell = useTranslations('shell');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} className="sticky top-0 hidden h-dvh lg:flex">
        <SidebarHeader className={collapsed ? 'justify-center px-0' : undefined}>
          <Link
            href="/"
            className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo compact={collapsed} />
          </Link>
        </SidebarHeader>
        <ShellNavigation sections={sections} />
        <SidebarFooter>
          <Button
            variant="ghost"
            className="w-full justify-start group-data-[collapsed=true]/sidebar:justify-center"
            aria-expanded={!collapsed}
            onClick={() => {
              setCollapsed((value) => !value);
            }}
          >
            <CollapseIcon className="rtl:-scale-x-100" aria-hidden="true" />
            <span className="group-data-[collapsed=true]/sidebar:sr-only">
              {collapsed ? tShell('expand') : tShell('collapse')}
            </span>
          </Button>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar>
          <TopbarSection>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label={t('openMenu')}
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="start"
                closeLabel={t('close')}
                aria-describedby={undefined}
                className="p-0"
              >
                <Sidebar className="w-full border-e-0">
                  <SidebarHeader>
                    <SheetTitle>
                      <BrandLogo />
                    </SheetTitle>
                  </SidebarHeader>
                  <ShellNavigation
                    sections={sections}
                    onNavigate={() => {
                      setMobileOpen(false);
                    }}
                  />
                </Sidebar>
              </SheetContent>
            </Sheet>
            <Badge tone="primary" className="text-sm">
              {portalLabel}
            </Badge>
          </TopbarSection>
          <TopbarSpacer />
          <TopbarSection>
            <LocaleSwitcher />
            <ThemeToggle />
            <UserMenu user={user} portal={portal} className="ms-2" />
          </TopbarSection>
        </Topbar>
        <main id={MAIN_CONTENT_ID} className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

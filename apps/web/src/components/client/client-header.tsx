'use client';

import type { CurrentUser } from '@drivetn/types';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@drivetn/ui/sheet';
import { type LucideIcon, Menu, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { UserMenu } from '@/components/auth/user-menu';
import { BrandLogo } from '@/components/brand-logo';
import { HEADER_NAV, isActivePath } from '@/components/client/client-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link, usePathname } from '@/i18n/navigation';

interface HeaderLink {
  id: string;
  label: string;
  href: string | null;
  icon: LucideIcon;
}

function HeaderNavLink({
  item,
  active,
  comingSoonLabel,
  layout,
  onNavigate,
}: {
  item: HeaderLink;
  active: boolean;
  comingSoonLabel: string;
  layout: 'inline' | 'stacked';
  onNavigate?: () => void;
}) {
  const className = cn(
    'flex items-center gap-2 rounded-control text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    layout === 'inline' ? 'h-9 px-3' : 'min-h-touch px-3',
  );

  if (item.href === null) {
    return (
      <span
        aria-disabled="true"
        className={cn(className, 'cursor-not-allowed text-muted-foreground/70')}
      >
        {layout === 'stacked' && <item.icon className="size-5" aria-hidden="true" />}
        <span className="flex-1">{item.label}</span>
        {layout === 'stacked' && <Badge>{comingSoonLabel}</Badge>}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        className,
        active
          ? 'bg-primary-soft text-primary-soft-foreground'
          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
      )}
    >
      {layout === 'stacked' && <item.icon className="size-5" aria-hidden="true" />}
      {item.label}
    </Link>
  );
}

export function ClientHeader({
  user,
  designEnabled,
}: {
  user: CurrentUser | null;
  designEnabled: boolean;
}) {
  const t = useTranslations('client.nav');
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const links: HeaderLink[] = [
    ...HEADER_NAV.map((item) => ({ ...item, label: t(item.id) })),
    ...(designEnabled
      ? [{ id: 'design', label: tShell('designSystem'), href: '/design', icon: Palette }]
      : []),
  ];

  const renderLinks = (layout: 'inline' | 'stacked', onNavigate?: () => void) =>
    links.map((item) => (
      <li key={item.id}>
        <HeaderNavLink
          item={item}
          layout={layout}
          active={item.href !== null && isActivePath(pathname, item.href)}
          comingSoonLabel={tCommon('comingSoon')}
          onNavigate={onNavigate}
        />
      </li>
    ));

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur transition-shadow duration-300 supports-[backdrop-filter]:bg-surface/70',
        scrolled && 'shadow-soft',
      )}
    >
      <div className="container flex h-16 items-center gap-6">
        <Link
          href="/"
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo />
        </Link>

        <nav aria-label={t('mainLabel')} className="hidden md:block">
          <ul className="flex items-center gap-1">{renderLinks('inline')}</ul>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          {user === null ? (
            <div className="ms-2 hidden items-center gap-2 md:flex">
              <Button variant="ghost" asChild>
                <Link href="/login">{t('login')}</Link>
              </Button>
              <Button asChild className="hidden lg:inline-flex">
                <Link href="/signup">{t('signup')}</Link>
              </Button>
            </div>
          ) : (
            <UserMenu user={user} portal="client" className="ms-2" />
          )}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={tCommon('openMenu')}
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="end" closeLabel={tCommon('close')} aria-describedby={undefined}>
              <SheetHeader>
                <SheetTitle>
                  <BrandLogo />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label={t('mainLabel')}>
                <ul className="grid gap-1">
                  {renderLinks('stacked', () => {
                    setMenuOpen(false);
                  })}
                </ul>
              </nav>
              {user === null && (
                <div className="mt-auto grid gap-2">
                  <Button variant="secondary" asChild>
                    <Link
                      href="/login"
                      onClick={() => {
                        setMenuOpen(false);
                      }}
                    >
                      {t('login')}
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link
                      href="/signup"
                      onClick={() => {
                        setMenuOpen(false);
                      }}
                    >
                      {t('signup')}
                    </Link>
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

'use client';

import { Button } from '@drivetn/ui/button';
import { useTranslations } from 'next-intl';

import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from '@/i18n/navigation';

export function AgencyWelcomeHeader() {
  const t = useTranslations('agency.welcome');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="container flex h-16 items-center gap-3">
        <Link
          href="/welcome"
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo />
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{t('headerLogin')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t('headerSignup')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

'use client';

import { Button } from '@drivetn/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@drivetn/ui/sheet';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from '@/i18n/navigation';

const NAV = [
  ['#service', 'navService'],
  ['#parcours', 'navSteps'],
  ['#essai', 'navTrial'],
  ['#formules', 'plansTitle'],
] as const;

export function AgencyWelcomeHeader() {
  const t = useTranslations('agency.welcome');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="container flex h-16 min-w-0 items-center gap-2">
        <Link
          href="/welcome"
          className="shrink-0 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-5 lg:flex" aria-label={t('eyebrow')}>
          {NAV.map(([href, key]) => (
            <a
              key={href}
              href={href}
              className="rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
          <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{t('headerLogin')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t('headerSignup')}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={tCommon('openMenu')}
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="end" closeLabel={tCommon('close')} aria-describedby={undefined}>
              <SheetTitle className="pe-10">{t('eyebrow')}</SheetTitle>
              <nav className="grid gap-1" aria-label={t('eyebrow')}>
                {NAV.map(([href, key]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="rounded-control px-3 py-3 text-base font-medium hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t(key)}
                  </a>
                ))}
                <Link
                  href="/login"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="rounded-control px-3 py-3 text-base font-medium hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('headerLogin')}
                </Link>
              </nav>
              <div className="mt-6 flex items-center gap-2 sm:hidden">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

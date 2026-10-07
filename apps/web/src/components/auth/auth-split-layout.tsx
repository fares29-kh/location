import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { MAIN_CONTENT_ID } from '@/components/skip-link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from '@/i18n/navigation';

const ASIDE_POINTS = {
  agency: ['fleet', 'bookings', 'payments'],
  admin: ['agencies', 'billing', 'audit'],
} as const;

/** Pages d'authentification des espaces agence et admin : panneau de marque + formulaire. */
export function AuthSplitLayout({
  portal,
  children,
}: {
  portal: 'agency' | 'admin';
  children: ReactNode;
}) {
  const t = useTranslations('auth.aside');
  const tCommon = useTranslations('common');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute -end-24 -top-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <p className="relative font-heading text-sm font-semibold uppercase tracking-widest opacity-80">
          {tCommon(`portals.${portal}`)}
        </p>
        <div className="relative mt-auto grid gap-6">
          <h2 className="font-heading text-3xl font-extrabold leading-tight">
            {portal === 'agency' ? t('agency.title') : t('admin.title')}
          </h2>
          <ul className="grid gap-3">
            {portal === 'agency'
              ? ASIDE_POINTS.agency.map((point) => (
                  <li key={point} className="flex gap-3">
                    <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    {t(`agency.points.${point}`)}
                  </li>
                ))
              : ASIDE_POINTS.admin.map((point) => (
                  <li key={point} className="flex gap-3">
                    <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    {t(`admin.points.${point}`)}
                  </li>
                ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center gap-2 px-4 sm:px-6">
          <Link
            href="/login"
            className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main
          id={MAIN_CONTENT_ID}
          className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

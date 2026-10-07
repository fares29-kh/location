'use client';

import { cn } from '@drivetn/ui/lib/cn';
import { useTranslations } from 'next-intl';

import { BOTTOM_NAV, isActivePath } from '@/components/client/client-nav';
import { Link, usePathname } from '@/i18n/navigation';

/** Barre d'onglets fixe en bas d'écran, sur mobile uniquement. */
export function MobileBottomNav() {
  const t = useTranslations('client.nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('mobileLabel')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {BOTTOM_NAV.map((item) => {
          const itemClass =
            'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors';
          const icon = <item.icon className="size-5" aria-hidden="true" />;

          if (item.href === null) {
            return (
              <li key={item.id}>
                <span aria-disabled="true" className={cn(itemClass, 'text-muted-foreground/60')}>
                  {icon}
                  {t(item.id)}
                </span>
              </li>
            );
          }

          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  itemClass,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {icon}
                {t(item.id)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

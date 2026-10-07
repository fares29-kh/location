'use client';

import { getDirection, isLocale, type Locale, LOCALES } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';

/** Chaque langue est présentée dans sa propre écriture. */
const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
};

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (!isLocale(next) || next === locale) {
      return;
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('language')} loading={isPending}>
          {!isPending && <Languages aria-hidden="true" />}
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              lang={option}
              dir={getDirection(option)}
            >
              {LOCALE_NAMES[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

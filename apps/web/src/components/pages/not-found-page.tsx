import { Button } from '@drivetn/ui/button';
import { MapPinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export function NotFoundContent() {
  const t = useTranslations();
  return (
    <div className="container grid place-items-center py-24 text-center">
      <div className="grid max-w-md justify-items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <MapPinOff className="size-8" aria-hidden="true" />
        </span>
        <p className="font-heading text-3xl font-extrabold text-primary">404</p>
        <h1 className="text-xl font-bold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.description')}</p>
        <Button asChild className="mt-2">
          <Link href="/">{t('common.backHome')}</Link>
        </Button>
      </div>
    </div>
  );
}

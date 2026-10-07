'use client';

import { Button } from '@drivetn/ui/button';
import { ErrorState } from '@drivetn/ui/error-state';
import { Spinner } from '@drivetn/ui/spinner';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { localizePath } from '@/lib/portal';

/** Échange le code de transfert (usage unique) contre une session sur ce portail. */
export function HandoffExchange({ code }: { code: string | null }) {
  const t = useTranslations('auth.handoff');
  const started = useRef(false);

  const exchange = useMutation({
    mutationFn: authApi.handoff,
    onSuccess: (result) => {
      window.location.replace(
        result.status === 'redirect' ? result.redirectUrl : localizePath(result.user.locale, '/'),
      );
    },
  });
  const { mutate } = exchange;

  useEffect(() => {
    if (code === null || started.current) {
      return;
    }
    started.current = true;
    mutate(code);
  }, [code, mutate]);

  if (code === null || exchange.isError) {
    return (
      <div className="grid gap-4">
        <ErrorState title={t('errorTitle')} description={t('errorText')} />
        <Button asChild size="lg">
          <Link href="/login">{t('backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div role="status" className="grid justify-items-center gap-4 py-8 text-center">
      <Spinner className="size-8 text-primary" />
      <div className="grid gap-1">
        <p className="font-heading text-lg font-semibold">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('text')}</p>
      </div>
    </div>
  );
}

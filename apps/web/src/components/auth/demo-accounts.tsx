'use client';

import type { DemoAccount } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { FlaskConical } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface DemoCredentials {
  accounts: readonly DemoAccount[];
  password: string;
}

/** Identifiants de test affichés sous le formulaire, uniquement quand les comptes de démo existent. */
export function DemoAccounts({
  demo,
  onUse,
}: {
  demo: DemoCredentials;
  onUse: (account: DemoAccount) => void;
}) {
  const t = useTranslations('auth.login.demo');

  return (
    <section
      aria-labelledby="demo-accounts-title"
      className="grid gap-3 rounded-lg border border-dashed border-border bg-surface-muted/50 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
          <FlaskConical className="size-4" aria-hidden="true" />
        </span>
        <div className="grid gap-0.5">
          <h2 id="demo-accounts-title" className="text-sm font-semibold">
            {t('title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <ul className="grid gap-2">
        {demo.accounts.map((account) => (
          <li
            key={account.email}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3"
          >
            <dl className="grid min-w-0 gap-1 text-xs">
              <div className="flex gap-1.5">
                <dt className="sr-only">{t('role')}</dt>
                <dd className="text-sm font-medium">{t(`roles.${account.portal}`)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{t('email')}</dt>
                <dd className="truncate font-mono select-all" dir="ltr">
                  {account.email}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{t('password')}</dt>
                <dd className="font-mono select-all" dir="ltr">
                  {demo.password}
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t('useLabel', { email: account.email })}
              onClick={() => {
                onUse(account);
              }}
            >
              {t('use')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

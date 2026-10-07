import { DEMO_PASSWORD, getDemoAccounts, type Portal } from '@drivetn/types';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { getServerEnv } from '@/env';
import { redirectIfAuthenticated } from '@/lib/auth/session';
import { sanitizeNextPath } from '@/lib/auth/routes';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';

import { AuthCard } from './auth-card';
import { ForgotPasswordForm } from './forgot-password-form';
import { HandoffExchange } from './handoff-exchange';
import { LoginForm } from './login-form';
import { SignupForm } from './signup-form';

export interface AuthPageProps extends LocaleParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type SignupPortal = Exclude<Portal, 'admin'>;

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

async function nextPathFrom(searchParams: AuthPageProps['searchParams']): Promise<string | null> {
  return sanitizeNextPath(firstParam((await searchParams).next));
}

/** Le portail client garde son en-tête et son pied de page : la carte est centrée dans le contenu. */
function AuthPageFrame({ portal, children }: { portal: Portal; children: ReactNode }) {
  return portal === 'client' ? (
    <div className="container flex justify-center py-10 sm:py-16">{children}</div>
  ) : (
    children
  );
}

const PAGE_TITLE_KEYS = {
  login: 'login.title',
  forgot: 'forgot.title',
  handoff: 'handoff.title',
  'signup.client': 'signup.title.client',
  'signup.agency': 'signup.title.agency',
} as const;

export function authPageMetadata(page: keyof typeof PAGE_TITLE_KEYS) {
  return async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
    const t = await getTranslations({ locale: await resolveLocale(params), namespace: 'auth' });
    return { title: t(PAGE_TITLE_KEYS[page]), robots: { index: false, follow: true } };
  };
}

export function createLoginPage(portal: Portal) {
  return async function LoginPage({ params, searchParams }: AuthPageProps) {
    const locale = await resolveLocale(params);
    await redirectIfAuthenticated(portal, locale);
    const t = await getTranslations({ locale, namespace: 'auth' });
    return (
      <AuthPageFrame portal={portal}>
        <AuthCard title={t('login.title')} description={t(`login.subtitle.${portal}`)}>
          <LoginForm
            portal={portal}
            nextPath={await nextPathFrom(searchParams)}
            demo={
              getServerEnv().DEMO_ACCOUNTS_ENABLED
                ? { accounts: getDemoAccounts(portal), password: DEMO_PASSWORD }
                : null
            }
          />
        </AuthCard>
      </AuthPageFrame>
    );
  };
}

export function createSignupPage(portal: SignupPortal) {
  return async function SignupPage({ params, searchParams }: AuthPageProps) {
    const locale = await resolveLocale(params);
    await redirectIfAuthenticated(portal, locale);
    const t = await getTranslations({ locale, namespace: 'auth' });
    return (
      <AuthPageFrame portal={portal}>
        <AuthCard title={t(`signup.title.${portal}`)} description={t(`signup.subtitle.${portal}`)}>
          <SignupForm nextPath={await nextPathFrom(searchParams)} />
        </AuthCard>
      </AuthPageFrame>
    );
  };
}

export function createForgotPasswordPage(portal: Portal) {
  return async function ForgotPasswordPage({ params }: LocaleParams) {
    const locale = await resolveLocale(params);
    await redirectIfAuthenticated(portal, locale);
    const t = await getTranslations({ locale, namespace: 'auth' });
    return (
      <AuthPageFrame portal={portal}>
        <AuthCard title={t('forgot.title')} description={t('forgot.subtitle')}>
          <ForgotPasswordForm />
        </AuthCard>
      </AuthPageFrame>
    );
  };
}

export function createHandoffPage(portal: Portal) {
  return async function HandoffPage({ params, searchParams }: AuthPageProps) {
    await resolveLocale(params);
    return (
      <AuthPageFrame portal={portal}>
        <div className="w-full max-w-md">
          <HandoffExchange code={firstParam((await searchParams).code)} />
        </div>
      </AuthPageFrame>
    );
  };
}

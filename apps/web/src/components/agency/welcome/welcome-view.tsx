import {
  formatMillimes,
  type Locale,
  type SubscriptionPlan,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { CircleCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

const FEATURES = [
  'account',
  'fleet',
  'planning',
  'online',
  'desk',
  'payments',
  'expenses',
  'stats',
  'pdf',
  'reviews',
  'map',
] as const;

function priceAmount(millimes: number, locale: Locale): { amount: string; currency: string } {
  const exact = formatMillimes(millimes, locale);
  const plain = formatMillimes(millimes, locale, { withCurrency: false });
  return {
    amount: plain.replace(/[,.]000$/, ''),
    currency: exact.replace(plain, '').trim(),
  };
}

function PlanColumn({
  plan,
  locale,
  name,
  role,
  perMonth,
  limit,
  difference,
  allFeatures,
  includedTitle,
  features,
  signup,
}: {
  plan: SubscriptionPlan;
  locale: Locale;
  name: string;
  role: string;
  perMonth: string;
  limit: string;
  difference: string;
  allFeatures: string;
  includedTitle: string;
  features: readonly string[];
  signup: string;
}) {
  const price = priceAmount(SUBSCRIPTION_PLAN_DEFINITIONS[plan].monthlyPriceMillimes, locale);
  const highlighted = plan === 'PRO';

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-surface shadow-soft',
        highlighted ? 'border-primary shadow-elevated ring-1 ring-primary' : 'border-border',
      )}
    >
      <header className="relative bg-zinc-950 px-6 pb-5 pt-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{role}</p>
        <h3 className="mt-2 font-heading text-2xl font-bold">{name}</h3>
        <p className="mt-1 text-sm text-white/70">{allFeatures}</p>
      </header>
      <div className={cn('px-6 py-6', highlighted && 'bg-primary-soft/40')}>
        <p className="flex items-end gap-2">
          <span className="font-heading text-5xl font-extrabold leading-none tabular-nums">
            {price.amount}
          </span>
          <span className="pb-1 text-lg font-semibold">{price.currency}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{perMonth}</p>
      </div>
      <div className="mx-6 rounded-2xl bg-primary-soft px-4 py-3 text-primary-soft-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide">{difference}</p>
        <p className="mt-1 font-medium">{limit}</p>
      </div>
      <p className="px-6 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {includedTitle}
      </p>
      <ul className="grid gap-0 px-6 py-2">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 border-b border-border/80 py-3 text-sm last:border-b-0"
          >
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto px-6 pb-6">
        <Button asChild className="w-full" variant={highlighted ? 'primary' : 'secondary'}>
          <Link href="/signup">{signup}</Link>
        </Button>
      </div>
    </article>
  );
}

export async function AgencyWelcome({ locale, clientUrl }: { locale: Locale; clientUrl: string }) {
  const t = await getTranslations({ locale, namespace: 'agency.welcome' });
  const features = FEATURES.map((id) => t(`feature.${id}`));

  return (
    <div className="pb-20">
      <section className="relative isolate overflow-hidden" aria-labelledby="agency-welcome-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
          <div className="absolute -end-24 top-10 size-80 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container grid items-end gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="grid max-w-2xl gap-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t('eyebrow')}
            </p>
            <h1
              id="agency-welcome-title"
              className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl"
            >
              {t('title')}
            </h1>
            <p className="text-lg text-muted-foreground">{t('lead')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">{t('signup')}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">{t('login')}</Link>
              </Button>
            </div>
          </div>
          <ul className="grid gap-3">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const price = priceAmount(
                SUBSCRIPTION_PLAN_DEFINITIONS[plan].monthlyPriceMillimes,
                locale,
              );
              return (
                <li key={plan}>
                  <a
                    href="#formules"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/80 px-5 py-4 shadow-soft backdrop-blur transition-colors hover:border-primary"
                  >
                    <span>
                      <span className="block text-sm text-muted-foreground">
                        {t(`planRole.${plan}`)}
                      </span>
                      <span className="font-heading text-lg font-bold">{t(`plans.${plan}`)}</span>
                    </span>
                    <span className="font-heading text-2xl font-extrabold tabular-nums">
                      {price.amount}{' '}
                      <span className="text-base font-semibold">{price.currency}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        id="formules"
        className="container scroll-mt-24 grid gap-8 pt-4"
        aria-labelledby="agency-plans-title"
      >
        <div className="mx-auto grid max-w-2xl gap-3 text-center">
          <h2 id="agency-plans-title" className="font-heading text-3xl font-extrabold">
            {t('plansTitle')}
          </h2>
          <p className="text-muted-foreground">{t('plansLead')}</p>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const definition = SUBSCRIPTION_PLAN_DEFINITIONS[plan];
            return (
              <PlanColumn
                key={plan}
                plan={plan}
                locale={locale}
                name={t(`plans.${plan}`)}
                role={t(`planRole.${plan}`)}
                perMonth={t('perMonth')}
                limit={
                  definition.vehicleLimit === null
                    ? t('unlimited')
                    : t('vehicleLimit', { count: definition.vehicleLimit })
                }
                difference={t('difference')}
                allFeatures={t('allFeatures')}
                includedTitle={t('includedTitle')}
                features={features}
                signup={t('signup')}
              />
            );
          })}
        </div>
      </section>

      <section className="container grid gap-6 pt-20" aria-labelledby="agency-steps-title">
        <h2 id="agency-steps-title" className="font-heading text-2xl font-bold">
          {t('stepsTitle')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {(['account', 'setup', 'review', 'rent'] as const).map((step, index) => (
            <li
              key={step}
              className="grid gap-3 rounded-[1.5rem] border border-border bg-surface p-5"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-zinc-950 font-heading text-sm font-bold text-white">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading text-base font-semibold">{t(`steps.${step}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container pt-12">
        <a
          href={clientUrl}
          className="text-sm font-medium text-foreground underline decoration-dotted underline-offset-4"
        >
          {t('clientSite')}
        </a>
      </section>
    </div>
  );
}

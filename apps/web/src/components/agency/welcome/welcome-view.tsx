import {
  formatMillimes,
  type Locale,
  type SubscriptionPlan,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import {
  Banknote,
  CalendarDays,
  Car,
  ChartColumn,
  CircleCheck,
  KeyRound,
  MapPin,
  Receipt,
  Search,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { SectionHeading } from '@/components/home/section-heading';
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

const PILLARS = ['find', 'book', 'run'] as const;

const SERVICES = [
  'fleet',
  'planning',
  'bookings',
  'payments',
  'expenses',
  'stats',
  'reviews',
  'visibility',
] as const;

const SERVICE_ICONS: Record<(typeof SERVICES)[number], LucideIcon> = {
  fleet: Car,
  planning: CalendarDays,
  bookings: KeyRound,
  payments: Banknote,
  expenses: Receipt,
  stats: ChartColumn,
  reviews: Star,
  visibility: MapPin,
};

const PILLAR_ICONS: Record<(typeof PILLARS)[number], LucideIcon> = {
  find: Search,
  book: KeyRound,
  run: ChartColumn,
};

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
          <span className="font-heading text-3xl font-extrabold leading-none tabular-nums sm:text-[3.25rem]">
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
    <div>
      <section className="relative isolate overflow-hidden" aria-labelledby="agency-welcome-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
          <div className="absolute -end-24 top-10 size-80 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="container grid min-w-0 grid-cols-1 items-center gap-10 py-12 sm:gap-12 sm:py-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid max-w-2xl gap-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t('eyebrow')}
            </p>
            <h1
              id="agency-welcome-title"
              className="font-heading text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
            >
              {t('title')}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">{t('lead')}</p>
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
            {PILLARS.map((id) => {
              const Icon = PILLAR_ICONS[id];
              return (
                <li
                  key={id}
                  className="flex items-start gap-4 rounded-[1.5rem] border border-border bg-surface/80 p-5 shadow-soft backdrop-blur"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="grid gap-1">
                    <span className="font-heading text-base font-semibold">
                      {t(`pillar.${id}.title`)}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {t(`pillar.${id}.text`)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section
        id="service"
        className="scroll-mt-24 border-y border-border bg-surface-muted/50 py-16 sm:py-24"
        aria-labelledby="agency-definition-title"
      >
        <div className="container grid gap-10">
          <SectionHeading
            id="agency-definition-title"
            eyebrow={t('definitionEyebrow')}
            title={t('definitionTitle')}
            align="start"
          />
          <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
            {t('definitionText')}
          </p>
          <div className="grid gap-4">
            <div className="grid max-w-2xl gap-3">
              <h3 className="font-heading text-2xl font-bold">{t('servicesTitle')}</h3>
              <p className="text-muted-foreground">{t('servicesLead')}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((id) => {
                const Icon = SERVICE_ICONS[id];
                return (
                  <li
                    key={id}
                    className="grid content-start gap-3 rounded-panel border border-border bg-surface p-5 shadow-soft"
                  >
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h4 className="font-heading text-base font-semibold">
                      {t(`services.${id}.title`)}
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(`services.${id}.text`)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="parcours"
        className="container scroll-mt-24 grid gap-10 py-16 sm:py-24"
        aria-labelledby="agency-steps-title"
      >
        <SectionHeading
          id="agency-steps-title"
          eyebrow={t('navSteps')}
          title={t('stepsTitle')}
          align="start"
        />
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
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`steps.${step}.text`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="essai"
        className="border-y border-border bg-surface-muted/50 py-16 sm:py-24"
        aria-labelledby="agency-trial-title"
      >
        <div className="container grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <SectionHeading
            id="agency-trial-title"
            eyebrow={t('trialEyebrow')}
            title={t('trialTitle')}
            align="start"
          />
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t('trialText')}
          </p>
        </div>
      </section>

      <section
        id="formules"
        className="scroll-mt-24 border-t border-border bg-surface-muted/40 py-16 sm:py-24"
        aria-labelledby="agency-plans-title"
      >
        <div className="container grid gap-10">
          <SectionHeading
            id="agency-plans-title"
            eyebrow={t('plansEyebrow')}
            title={t('plansTitle')}
            text={t('plansLead')}
          />
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
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="agency-closing-title">
        <div className="grid min-w-0 grid-cols-1 gap-6 rounded-[2rem] bg-zinc-950 px-6 py-12 text-white sm:px-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid max-w-2xl gap-3">
            <h2
              id="agency-closing-title"
              className="font-heading text-2xl font-extrabold sm:text-3xl"
            >
              {t('closingTitle')}
            </h2>
            <p className="text-base leading-relaxed text-white/75">{t('closingText')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/signup">{t('signup')}</Link>
            </Button>
            <a
              href={clientUrl}
              className="text-sm font-medium text-white underline decoration-dotted underline-offset-4"
            >
              {t('clientSite')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

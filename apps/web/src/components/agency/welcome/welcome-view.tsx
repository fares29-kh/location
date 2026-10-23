import {
  formatMillimes,
  type Locale,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  SUBSCRIPTION_PLANS,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@drivetn/ui/card';
import {
  CalendarCheck,
  CalendarDays,
  CarFront,
  ChartColumn,
  MapPin,
  Receipt,
  Star,
  Wallet,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

const SERVICES = [
  { id: 'fleet', icon: CarFront },
  { id: 'planning', icon: CalendarDays },
  { id: 'bookings', icon: CalendarCheck },
  { id: 'payments', icon: Wallet },
  { id: 'expenses', icon: Receipt },
  { id: 'stats', icon: ChartColumn },
  { id: 'reviews', icon: Star },
  { id: 'visibility', icon: MapPin },
] as const;

const STEPS = ['account', 'setup', 'review', 'rent'] as const;

export async function AgencyWelcome({ locale, clientUrl }: { locale: Locale; clientUrl: string }) {
  const t = await getTranslations({ locale, namespace: 'agency.welcome' });

  return (
    <div className="grid gap-16 pb-20 sm:gap-24">
      <section
        className="container grid gap-6 pt-12 sm:pt-20"
        aria-labelledby="agency-welcome-title"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {t('eyebrow')}
        </p>
        <div className="grid max-w-3xl gap-4">
          <h1
            id="agency-welcome-title"
            className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl"
          >
            {t('title')}
          </h1>
          <p className="text-lg text-muted-foreground">{t('lead')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/signup">{t('signup')}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/login">{t('login')}</Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-6" aria-labelledby="agency-services-title">
        <div className="grid max-w-2xl gap-2">
          <h2 id="agency-services-title" className="font-heading text-2xl font-bold">
            {t('servicesTitle')}
          </h2>
          <p className="text-muted-foreground">{t('servicesLead')}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <li key={service.id}>
              <Card className="h-full">
                <CardHeader className="gap-3">
                  <span className="flex size-10 items-center justify-center rounded-control bg-primary-soft text-primary-soft-foreground">
                    <service.icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-base">{t(`services.${service.id}.title`)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t(`services.${service.id}.text`)}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="container grid gap-6" aria-labelledby="agency-steps-title">
        <h2 id="agency-steps-title" className="font-heading text-2xl font-bold">
          {t('stepsTitle')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step} className="grid gap-2 rounded-card border border-border bg-surface p-5">
              <span className="font-heading text-sm font-bold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading text-base font-semibold">{t(`steps.${step}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container grid gap-6" aria-labelledby="agency-plans-title">
        <div className="grid max-w-2xl gap-2">
          <h2 id="agency-plans-title" className="font-heading text-2xl font-bold">
            {t('plansTitle')}
          </h2>
          <p className="text-muted-foreground">{t('plansLead')}</p>
        </div>
        <ul className="grid gap-4 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const definition = SUBSCRIPTION_PLAN_DEFINITIONS[plan];
            return (
              <li key={plan}>
                <Card className="flex h-full flex-col">
                  <CardHeader className="gap-2">
                    <CardTitle className="flex items-center justify-between gap-3 text-lg">
                      {t(`plans.${plan}`)}
                      {plan === 'STARTER' ? (
                        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-soft-foreground">
                          {t('included')}
                        </span>
                      ) : null}
                    </CardTitle>
                    <p className="font-heading text-3xl font-bold tabular-nums">
                      {formatMillimes(definition.monthlyPriceMillimes, locale)}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('perMonth')}</p>
                  </CardHeader>
                  <CardContent className="mt-auto grid gap-4">
                    <p className="text-sm">
                      {definition.vehicleLimit === null
                        ? t('unlimited')
                        : t('vehicleLimit', { count: definition.vehicleLimit })}
                    </p>
                    <Button asChild variant={plan === 'STARTER' ? 'primary' : 'secondary'}>
                      <Link href="/signup">{t('signup')}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container">
        <p className="text-sm text-muted-foreground">
          <a
            href={clientUrl}
            className="font-medium text-foreground underline decoration-dotted underline-offset-4"
          >
            {t('clientSite')}
          </a>
        </p>
      </section>
    </div>
  );
}

import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { BadgeCheck, Building2, MessageCircle, Search, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { ApiStatus, ApiStatusSkeleton } from '@/components/api-status';

export function ClientHome() {
  const t = useTranslations('client.home');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('apiStatus');

  const features = [
    {
      id: 'noPayment',
      icon: ShieldCheck,
      title: t('features.noPaymentTitle'),
      text: t('features.noPaymentText'),
    },
    {
      id: 'local',
      icon: BadgeCheck,
      title: t('features.localTitle'),
      text: t('features.localText'),
    },
    {
      id: 'contact',
      icon: MessageCircle,
      title: t('features.contactTitle'),
      text: t('features.contactText'),
    },
  ];

  return (
    <>
      <section className="bg-gradient-to-b from-primary-soft/70 to-background">
        <div className="container grid gap-6 py-16 sm:py-24">
          <Badge tone="primary" className="w-fit text-sm">
            {t('eyebrow')}
          </Badge>
          <h1 className="max-w-3xl text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{t('subtitle')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="cta" size="lg" disabled>
              <Search aria-hidden="true" />
              {t('searchCta')}
              <Badge className="bg-white/20 text-white">{tCommon('comingSoon')}</Badge>
            </Button>
            <Button variant="secondary" size="lg" disabled>
              <Building2 aria-hidden="true" />
              {t('agencyCta')}
            </Button>
          </div>
        </div>
      </section>

      <section className="container grid gap-4 py-12 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.id} className="grid content-start gap-3 p-6">
            <span className="flex size-11 items-center justify-center rounded-control bg-primary-soft text-primary-soft-foreground">
              <feature.icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="text-sm text-muted-foreground">{feature.text}</p>
          </Card>
        ))}
      </section>

      <section className="container pb-16">
        <div className="max-w-md">
          <Suspense fallback={<ApiStatusSkeleton title={tStatus('title')} />}>
            <ApiStatus />
          </Suspense>
        </div>
      </section>
    </>
  );
}

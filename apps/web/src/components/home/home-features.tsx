import { getDirection, LOCALES, PAYMENT_METHODS } from '@drivetn/types';
import { cn } from '@drivetn/ui/lib/cn';
import { PaymentMethodBadges } from '@drivetn/ui/payment-method-badges';
import { BadgeCheck, Languages, type LucideIcon, MessageCircle, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LOCALE_NAMES } from '@/i18n/locale-names';

import { SectionHeading } from './section-heading';

function FeatureTile({
  icon: Icon,
  iconClassName,
  title,
  text,
  className,
  children,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <li
      className={cn(
        'reveal group relative grid content-start gap-4 overflow-hidden rounded-panel border border-border bg-surface p-6 shadow-soft transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-elevated sm:p-8',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -end-16 -top-16 size-40 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl shadow-soft',
          iconClassName,
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="grid gap-2">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
      {children}
    </li>
  );
}

export function HomeFeatures() {
  const t = useTranslations('client.home.features');
  const tMethod = useTranslations('status.paymentMethod');

  return (
    <section
      aria-labelledby="features-title"
      className="border-y border-border bg-surface-muted/50 py-16 sm:py-24"
    >
      <div className="container">
        <SectionHeading id="features-title" eyebrow={t('eyebrow')} title={t('title')} />

        <ul className="mt-14 grid gap-4 md:grid-cols-3 md:gap-5">
          <FeatureTile
            icon={ShieldCheck}
            iconClassName="bg-gradient-to-br from-primary to-info text-white"
            title={t('noPaymentTitle')}
            text={t('noPaymentText')}
            className="md:col-span-2"
          >
            <div className="grid gap-2">
              <p className="text-xs font-semibold text-muted-foreground">{t('paymentMethods')}</p>
              <PaymentMethodBadges
                methods={PAYMENT_METHODS}
                getLabel={(method) => tMethod(method)}
              />
            </div>
          </FeatureTile>

          <FeatureTile
            icon={BadgeCheck}
            iconClassName="bg-success-soft text-success-soft-foreground"
            title={t('localTitle')}
            text={t('localText')}
          />

          <FeatureTile
            icon={MessageCircle}
            iconClassName="bg-[#25D366] text-white"
            title={t('contactTitle')}
            text={t('contactText')}
          />

          <FeatureTile
            icon={Languages}
            iconClassName="bg-cta-soft text-cta-soft-foreground"
            title={t('languagesTitle')}
            text={t('languagesText')}
            className="md:col-span-2"
          >
            <ul className="flex flex-wrap gap-2">
              {LOCALES.map((locale) => (
                <li
                  key={locale}
                  lang={locale}
                  dir={getDirection(locale)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium"
                >
                  {LOCALE_NAMES[locale]}
                </li>
              ))}
            </ul>
          </FeatureTile>
        </ul>
      </div>
    </section>
  );
}

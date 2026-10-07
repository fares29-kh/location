import { CalendarCheck, HandCoins, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SectionHeading } from './section-heading';

const STEPS = [
  { id: 'search', icon: Search },
  { id: 'book', icon: CalendarCheck },
  { id: 'pay', icon: HandCoins },
] as const;

export function HowItWorks() {
  const t = useTranslations('client.home.howItWorks');

  return (
    <section aria-labelledby="how-title" className="container py-16 sm:py-24">
      <SectionHeading id="how-title" eyebrow={t('eyebrow')} title={t('title')} />

      <div className="relative mt-14">
        <div
          aria-hidden="true"
          className="absolute inset-x-[16.66%] top-8 hidden border-t-2 border-dashed border-primary/25 md:block"
        />
        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, index) => (
            <li key={step.id} className="reveal grid justify-items-center gap-3 text-center">
              <span className="relative mb-2 flex size-16 items-center justify-center rounded-2xl bg-surface shadow-elevated ring-1 ring-border">
                <step.icon className="size-7 text-primary" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -end-2.5 -top-2.5 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-4 ring-background"
                >
                  {index + 1}
                </span>
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t('step', { step: String(index + 1) })}
              </p>
              <h3 className="text-lg font-bold">{t(`${step.id}Title`)}</h3>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t(`${step.id}Text`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

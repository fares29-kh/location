import { Plane } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AIRPORTS } from './places';
import { SectionHeading } from './section-heading';

export function HomeAirports() {
  const t = useTranslations('client.home');

  return (
    <section aria-labelledby="airports-title" className="container py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <SectionHeading
          id="airports-title"
          align="start"
          eyebrow={t('airports.eyebrow')}
          title={t('airports.title')}
          text={t('airports.text')}
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {AIRPORTS.map((airport) => (
            <li
              key={airport.id}
              className="reveal flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-soft transition-colors duration-300 hover:border-primary/30"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Plane className="size-5 rtl:-scale-x-100" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">
                {t(`places.${airport.id}`)}
              </span>
              <span
                dir="ltr"
                className="rounded-md bg-surface-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground"
              >
                {airport.code}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

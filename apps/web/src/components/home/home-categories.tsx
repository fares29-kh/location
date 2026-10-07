import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { Money } from '@drivetn/ui/money';
import { ArrowRight, Briefcase, CarFront, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { CATEGORY_GRADIENTS, SAMPLE_OFFERS, VEHICLE_CATEGORIES } from '@/components/search/catalog';
import { buildSearchHref } from '@/components/search/search-href';
import { Link } from '@/i18n/navigation';

import { SectionHeading } from './section-heading';

export function HomeCategories() {
  const t = useTranslations('client.home.categories');
  const tCatalog = useTranslations('client.catalog');
  const locale = useLocale();
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });

  return (
    <section
      aria-labelledby="categories-title"
      className="border-y border-border bg-surface-muted/50 py-16 sm:py-24"
    >
      <div className="container">
        <SectionHeading
          id="categories-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          text={t('text')}
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {VEHICLE_CATEGORIES.map((category) => {
            const offers = SAMPLE_OFFERS.filter((offer) => offer.category === category);
            const seats = Math.max(...offers.map((offer) => offer.seats));
            const bags = Math.max(...offers.map((offer) => offer.bags));
            const fromPrice = Math.min(...offers.map((offer) => offer.pricePerDayMillimes));
            return (
              <li key={category} className="reveal grid">
                <Link
                  href={buildSearchHref({ category })}
                  className="group flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div
                    className={cn(
                      'relative flex h-28 items-center justify-between gap-4 overflow-hidden bg-gradient-to-br px-6',
                      CATEGORY_GRADIENTS[category],
                    )}
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgb(255_255_255/0.3),transparent_60%)]"
                    />
                    <h3 className="relative text-xl font-bold text-white">
                      {tCatalog(`categories.${category}`)}
                    </h3>
                    <CarFront
                      aria-hidden="true"
                      strokeWidth={1.25}
                      className="relative size-16 shrink-0 text-white/90 drop-shadow-[0_8px_14px_rgb(0_0_0/0.25)] transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <p className="text-sm text-muted-foreground">{tCatalog(`hints.${category}`)}</p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
                      <li className="flex items-center gap-1.5">
                        <Users className="size-4 text-primary" aria-hidden="true" />
                        {t('seats', { count: seats })}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Briefcase className="size-4 text-primary" aria-hidden="true" />
                        {t('bags', { count: bags })}
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {t('examples', { models: list.format(offers.map((offer) => offer.model)) })}
                    </p>
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-border pt-4">
                      <p className="flex items-baseline gap-1 text-sm text-muted-foreground">
                        {t('from')}
                        <Money
                          millimes={fromPrice}
                          locale={locale}
                          className="font-heading text-lg font-extrabold text-foreground"
                        />
                        {t('perDay')}
                      </p>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        {t('explore')}
                        <ArrowRight
                          className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-center text-xs text-muted-foreground">{t('priceNote')}</p>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="secondary" size="lg">
            <Link href="/search">
              {t('all')}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

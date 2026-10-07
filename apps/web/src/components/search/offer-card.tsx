'use client';

import type { Locale } from '@drivetn/types';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { Money } from '@drivetn/ui/money';
import { Rating } from '@drivetn/ui/rating';
import { toast } from '@drivetn/ui/toaster';
import {
  BadgeCheck,
  Briefcase,
  CarFront,
  Cog,
  Fuel,
  Gauge,
  type LucideIcon,
  MapPin,
  Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { CATEGORY_GRADIENTS, type SampleOffer } from './catalog';

function formatRating(value: number, locale: Locale): string {
  const fixed = value.toFixed(1);
  return locale === 'fr' ? fixed.replace('.', ',') : fixed;
}

function Spec({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </li>
  );
}

export function OfferCard({
  offer,
  locationLabel,
  days,
}: {
  offer: SampleOffer;
  /** Lieu recherché ; à défaut, la ville de l'offre. */
  locationLabel: string | null;
  days: number | null;
}) {
  const t = useTranslations('client.search.offer');
  const tCatalog = useTranslations('client.catalog');
  const tPlaces = useTranslations('client.home.places');
  const locale = useLocale();
  const rating = formatRating(offer.rating, locale);

  return (
    <article className="group flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
      <div
        className={cn(
          'relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br',
          CATEGORY_GRADIENTS[offer.category],
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(255_255_255/0.28),transparent_55%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-14 -end-8 size-40 rounded-full border-[20px] border-white/10"
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-10 bg-black/15" />
        <div
          aria-hidden="true"
          className="absolute inset-x-6 bottom-5 border-t-2 border-dashed border-white/35"
        />
        <CarFront
          aria-hidden="true"
          className="relative size-20 text-white drop-shadow-[0_10px_18px_rgb(0_0_0/0.3)] transition-transform duration-500 group-hover:scale-110"
          strokeWidth={1.25}
        />
        <span className="absolute start-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          {tCatalog(`categories.${offer.category}`)}
        </span>
        <span className="absolute end-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
          {t('preview')}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="grid gap-1">
          <h3 className="text-lg font-bold leading-tight">
            {offer.model}{' '}
            <span className="text-sm font-medium text-muted-foreground">{t('orSimilar')}</span>
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <Rating value={offer.rating} label={t('rating', { value: rating })} />
            <span className="font-semibold tabular-nums">{rating}</span>
            <span className="text-muted-foreground">
              ({t('reviews', { count: offer.reviews })})
            </span>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Spec icon={Users} label={t('seats', { count: offer.seats })} />
          <Spec icon={Briefcase} label={t('bags', { count: offer.bags })} />
          <Spec icon={Cog} label={tCatalog(`transmission.${offer.transmission}`)} />
          <Spec icon={Fuel} label={tCatalog(`fuel.${offer.fuel}`)} />
        </ul>

        <div className="flex flex-wrap gap-2">
          <Badge tone={offer.unlimitedMileage ? 'success' : 'neutral'}>
            <Gauge aria-hidden="true" />
            {offer.unlimitedMileage ? t('unlimitedMileage') : t('limitedMileage')}
          </Badge>
          <Badge tone="primary">
            <BadgeCheck aria-hidden="true" />
            {t('verifiedAgency')}
          </Badge>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{locationLabel ?? tPlaces(offer.city)}</span>
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
          <div className="grid min-w-0 gap-0.5">
            <p className="flex items-baseline gap-1">
              <Money
                millimes={offer.pricePerDayMillimes}
                locale={locale}
                className="font-heading text-xl font-extrabold"
              />
              <span className="text-sm text-muted-foreground">{t('perDay')}</span>
            </p>
            {days !== null ? (
              <p className="text-xs text-muted-foreground">
                {t('total', { count: days })}{' '}
                <Money
                  millimes={offer.pricePerDayMillimes * days}
                  locale={locale}
                  className="font-semibold text-foreground"
                />
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('deposit')} <Money millimes={offer.depositMillimes} locale={locale} />
              </p>
            )}
          </div>
          <Button
            variant="cta"
            className="shadow-md shadow-cta/20"
            onClick={() => {
              toast.info(t('bookSoonTitle'), { description: t('bookSoonText') });
            }}
          >
            {t('book')}
          </Button>
        </div>
      </div>
    </article>
  );
}

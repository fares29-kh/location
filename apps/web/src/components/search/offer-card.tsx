'use client';

import { type Locale, rentalPriceMillimes } from '@drivetn/types';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { Money } from '@drivetn/ui/money';
import { Rating } from '@drivetn/ui/rating';
import {
  BadgeCheck,
  Building2,
  Camera,
  CarFront,
  Cog,
  Fuel,
  Gauge,
  type LucideIcon,
  Snowflake,
  Users,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { AgencyLogo } from '../agencies/agency-logo';
import { useCategoryLabel } from '../vehicle-categories';
import { categoryGradient, type SearchOffer } from './catalog';

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
  days,
  onBook,
}: {
  offer: SearchOffer;
  /** Durée de la location quand les dates sont choisies. */
  days: number | null;
  onBook: (offer: SearchOffer) => void;
}) {
  const t = useTranslations('client.search.offer');
  const tCatalog = useTranslations('client.catalog');
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const rating = offer.rating === null ? null : formatRating(offer.rating, locale);
  const cover = offer.photos[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
      <div
        className={cn(
          'relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br',
          categoryGradient(offer.category),
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
        {cover !== undefined && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- médias déjà redimensionnés en WebP */}
            <img
              src={cover.thumbUrl}
              alt={t('photoAlt', { vehicle: `${offer.brand} ${offer.model}` })}
              width={cover.width}
              height={cover.height}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent"
            />
          </>
        )}
        {offer.photos.length > 1 && (
          <span className="absolute bottom-3 end-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-white backdrop-blur">
            <Camera className="size-3" aria-hidden="true" />
            <span className="sr-only">{t('photoCount', { count: offer.photos.length })}</span>
            <span aria-hidden="true">{offer.photos.length}</span>
          </span>
        )}
        <span className="absolute start-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          {categoryLabel(offer.category)}
        </span>
        {offer.agency.instantConfirmation && (
          <span className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[0.6875rem] font-semibold text-white/95 backdrop-blur">
            <Zap className="size-3" aria-hidden="true" />
            {t('instant')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="grid gap-1">
          <h3 className="text-lg font-bold leading-tight">
            {offer.brand} {offer.model}{' '}
            <span className="text-sm font-medium text-muted-foreground">{offer.year}</span>
          </h3>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            {offer.agency.logoUrl === null ? (
              <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <AgencyLogo
                name={offer.agency.name}
                logoUrl={offer.agency.logoUrl}
                className="size-6 rounded-md p-0.5 ring-1 ring-border"
              />
            )}
            <span className="truncate font-medium text-foreground">{offer.agency.name}</span>
          </p>
          <div className="flex items-center gap-2 text-sm">
            {offer.rating !== null && rating !== null ? (
              <>
                <Rating value={offer.rating} label={t('rating', { value: rating })} />
                <span className="font-semibold tabular-nums">{rating}</span>
                <span className="text-muted-foreground">
                  ({t('reviews', { count: offer.reviews })})
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{t('newAgency')}</span>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Spec icon={Users} label={t('seats', { count: offer.seats })} />
          <Spec icon={Cog} label={tCatalog(`transmission.${offer.transmission}`)} />
          <Spec icon={Fuel} label={tCatalog(`fuel.${offer.fuel}`)} />
          {offer.airConditioning && <Spec icon={Snowflake} label={t('airConditioning')} />}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Badge tone={offer.unlimitedMileage ? 'success' : 'neutral'}>
            <Gauge aria-hidden="true" />
            {offer.mileageLimitKm === null
              ? t('unlimitedMileage')
              : t('mileagePerDay', { km: offer.mileageLimitKm })}
          </Badge>
          <Badge tone="primary">
            <BadgeCheck aria-hidden="true" />
            {t('verifiedAgency')}
          </Badge>
        </div>

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
                  millimes={rentalPriceMillimes(offer.pricePerDayMillimes, days)}
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
              onBook(offer);
            }}
          >
            {t('book')}
          </Button>
        </div>
      </div>
    </article>
  );
}

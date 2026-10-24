'use client';

import { buildWhatsAppUrl, formatNationalPhone, type PublicAgency, toE164 } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { Money } from '@drivetn/ui/money';
import { WhatsAppIcon } from '@drivetn/ui/whatsapp-button';
import {
  ArrowRight,
  CarFront,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  X,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { buildSearchHref } from '@/components/search/search-href';
import { useCategoryLabel } from '@/components/vehicle-categories';
import { Link } from '@/i18n/navigation';

import { directionsUrl } from './agency-directory';
import { AgencyLogo } from './agency-logo';

export function AgencyAvatar({
  agency,
}: {
  agency: Pick<PublicAgency, 'id' | 'name' | 'logoUrl'>;
}) {
  return <AgencyLogo name={agency.name} logoUrl={agency.logoUrl} seed={agency.id} />;
}

function useDistanceLabel() {
  const t = useTranslations('client.agencies.map');
  const locale = useLocale();
  return (km: number) =>
    t('distance', {
      distance: new Intl.NumberFormat(`${locale}-TN-u-nu-latn`, {
        maximumFractionDigits: km < 10 ? 1 : 0,
      }).format(km),
    });
}

function useVehiclesLabel() {
  const t = useTranslations('client.agencies.map');
  return ({ vehiclesCount }: Pick<PublicAgency, 'vehiclesCount'>) =>
    vehiclesCount === 0 ? t('fleetSoon') : t('vehicles', { count: vehiclesCount });
}

function RatingPill({ agency }: { agency: PublicAgency }) {
  const t = useTranslations('client.agencies.map');
  const locale = useLocale();
  if (agency.rating === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-info-soft-foreground">
        {t('newAgency')}
      </span>
    );
  }
  const rating = new Intl.NumberFormat(`${locale}-TN-u-nu-latn`, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(agency.rating);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
      title={t('ratingLabel', { rating })}
    >
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="sr-only">{t('ratingLabel', { rating })}</span>
      <span aria-hidden="true">{rating}</span>
      <span className="font-medium text-amber-700/70 dark:text-amber-300/70">
        ({t('reviews', { count: agency.reviewsCount })})
      </span>
    </span>
  );
}

function FromPrice({ agency, className }: { agency: PublicAgency; className?: string }) {
  const t = useTranslations('client.agencies.map');
  const locale = useLocale();
  if (agency.fromDailyRateMillimes === null) {
    return null;
  }
  return (
    <p className={cn('flex items-baseline gap-1 text-sm text-muted-foreground', className)}>
      {t('from')}
      <Money
        millimes={agency.fromDailyRateMillimes}
        locale={locale}
        className="font-heading text-base font-extrabold text-foreground"
      />
      {t('perDay')}
    </p>
  );
}

/** Élément de la liste, synchronisé avec le marqueur de la carte. */
export function AgencyListItem({
  agency,
  governorate,
  distanceKm,
  selected,
  highlighted,
  onSelect,
  onHover,
}: {
  agency: PublicAgency;
  governorate: string;
  distanceKm: number | null;
  selected: boolean;
  highlighted: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const t = useTranslations('client.agencies.map');
  const distanceLabel = useDistanceLabel();
  const vehiclesLabel = useVehiclesLabel();

  return (
    <article
      data-agency-id={agency.id}
      onMouseEnter={() => {
        onHover(agency.id);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
      onFocus={() => {
        onHover(agency.id);
      }}
      onBlur={() => {
        onHover(null);
      }}
      className={cn(
        'group relative grid gap-3 rounded-card border bg-surface p-4 transition-[border-color,box-shadow,background-color] duration-200',
        selected
          ? 'border-primary bg-primary-soft/40 shadow-elevated ring-1 ring-primary'
          : highlighted
            ? 'border-primary/40 shadow-elevated'
            : 'border-border shadow-soft hover:border-primary/40 hover:shadow-elevated',
      )}
    >
      <div className="flex items-start gap-3">
        <AgencyAvatar agency={agency} />
        <div className="grid min-w-0 flex-1 gap-1">
          <h3 className="truncate text-base font-bold leading-tight">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelect(agency.id);
              }}
              className="text-start after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {agency.name}
            </button>
          </h3>
          <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">
              {governorate}
              {distanceKm !== null && (
                <span className="font-medium text-foreground"> · {distanceLabel(distanceKm)}</span>
              )}
            </span>
          </p>
        </div>
        <RatingPill agency={agency} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <CarFront className="size-3.5" aria-hidden="true" />
          {vehiclesLabel(agency)}
        </span>
        {agency.instantConfirmation && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground">
            <Zap className="size-3.5" aria-hidden="true" />
            {t('instant')}
          </span>
        )}
      </div>

      {agency.fromDailyRateMillimes !== null && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <FromPrice agency={agency} />
          <ArrowRight
            className="size-4 text-primary transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      )}
    </article>
  );
}

/** Fiche détaillée affichée dans la bulle de la carte. */
export function AgencyPopupCard({
  agency,
  governorate,
  distanceKm,
  signedIn,
  onClose,
}: {
  agency: PublicAgency;
  governorate: string;
  distanceKm: number | null;
  signedIn: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('client.agencies.map');
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const distanceLabel = useDistanceLabel();
  const showContacts = signedIn && agency.phone.length > 0;
  const iconLinkClass =
    'flex size-9 shrink-0 items-center justify-center rounded-control border border-border transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="grid w-[min(20rem,calc(100vw-3rem))] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-card border border-border bg-surface text-foreground">
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-primary/15 via-primary-soft/60 to-info/10 p-3.5 pe-11">
        <AgencyAvatar agency={agency} />
        <div className="grid min-w-0 gap-0.5">
          <h3 className="line-clamp-2 text-base font-extrabold leading-tight">{agency.name}</h3>
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {governorate}
            {distanceKm !== null && ` · ${distanceLabel(distanceKm)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <RatingPill agency={agency} />
          {agency.instantConfirmation && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground">
              <Zap className="size-3.5" aria-hidden="true" />
              {t('instant')}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border text-center rtl:divide-x-reverse">
          <div className="grid content-start gap-0.5 px-1.5 py-2">
            <dt className="flex items-center justify-center gap-1 text-[0.7rem] leading-tight text-muted-foreground">
              <CarFront className="size-3 shrink-0" aria-hidden="true" />
              {t('statVehicles')}
            </dt>
            <dd className="text-sm font-bold tabular-nums">
              {agency.vehiclesCount === 0 ? '—' : agency.vehiclesCount}
            </dd>
          </div>
          <div className="grid content-start gap-0.5 px-1.5 py-2">
            <dt className="text-[0.7rem] leading-tight text-muted-foreground">{t('statFrom')}</dt>
            <dd className="text-sm font-bold">
              {agency.fromDailyRateMillimes === null ? (
                '—'
              ) : (
                <Money millimes={agency.fromDailyRateMillimes} locale={locale} />
              )}
            </dd>
          </div>
          <div className="grid content-start gap-0.5 px-1.5 py-2">
            <dt className="flex items-center justify-center gap-1 text-[0.7rem] leading-tight text-muted-foreground">
              <ShieldCheck className="size-3 shrink-0 text-success" aria-hidden="true" />
              {t('statCancellation')}
            </dt>
            <dd className="text-sm font-bold">
              {t('cancellationHours', { hours: agency.freeCancellationHours })}
            </dd>
          </div>
        </dl>

        <div className="grid gap-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{agency.address}</span>
          </p>
          {signedIn && agency.extraPhones.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {agency.extraPhones.map((extraPhone) => (
                <li key={extraPhone}>
                  <a
                    href={`tel:${toE164(extraPhone)}`}
                    className="inline-flex items-center gap-1 font-medium text-foreground"
                    dir="ltr"
                  >
                    <Phone className="size-3.5 text-primary" aria-hidden="true" />
                    {formatNationalPhone(extraPhone)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {agency.categories.length > 0 && (
            <p className="flex items-center gap-1.5">
              <CarFront className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t('categories')} :</span>
              <span className="truncate">
                {agency.categories.map((category) => categoryLabel(category)).join(' · ')}
              </span>
            </p>
          )}
        </div>

        {!signedIn && (
          <div className="grid gap-2 rounded-xl border border-primary/25 bg-primary-soft p-3">
            <p className="text-xs leading-relaxed text-foreground">{t('contactsLocked')}</p>
            <Button asChild size="sm">
              <Link href="/signup">{t('contactsLockedAction')}</Link>
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="min-w-0 flex-1">
            <Link href={buildSearchHref({ governorate: agency.governorateCode })}>
              <span className="truncate">{t('seeCars')}</span>
              <ArrowRight aria-hidden="true" className="rtl:-scale-x-100" />
            </Link>
          </Button>
          {showContacts && (
            <>
              <a
                href={buildWhatsAppUrl(
                  agency.whatsappPhone,
                  t('whatsappMessage', { name: agency.name }),
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('whatsapp')}
                title={t('whatsapp')}
                className={cn(
                  iconLinkClass,
                  'border-transparent bg-[#25D366]/10 text-[#128C4B] hover:bg-[#25D366]/20 dark:text-[#4ADE80]',
                )}
              >
                <WhatsAppIcon className="size-4" />
              </a>
              <a
                href={`tel:${toE164(agency.phone)}`}
                aria-label={`${t('call')} ${formatNationalPhone(agency.phone)}`}
                title={formatNationalPhone(agency.phone)}
                className={iconLinkClass}
              >
                <Phone className="size-4 text-primary" aria-hidden="true" />
              </a>
            </>
          )}
          <a
            href={directionsUrl(agency)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('directions')}
            title={t('directions')}
            className={iconLinkClass}
          >
            <Navigation className="size-4 text-primary" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}

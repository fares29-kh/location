import { Badge } from '@drivetn/ui/badge';
import { Money } from '@drivetn/ui/money';
import { CalendarDays, CarFront, CircleCheck, MessageCircle, Plane } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

const PREVIEW_TOTAL_MILLIMES = 255_000;

/** Illustration du hero : une réservation type, sans données réelles. */
export function HeroPreview() {
  const t = useTranslations('client.home');
  const locale = useLocale();

  return (
    <div
      role="img"
      aria-label={t('preview.label')}
      className="relative mx-auto w-full max-w-md select-none px-8 pb-20 pt-10"
    >
      <div
        aria-hidden="true"
        className="absolute inset-10 -z-10 rounded-full bg-gradient-to-tr from-primary/40 to-info/30 blur-3xl"
      />

      <div className="animate-float">
        <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-elevated">
          <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary to-info">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgb(255_255_255/0.3),transparent_55%)]" />
            <div className="absolute -bottom-16 -end-10 size-48 rounded-full border-[24px] border-white/10" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-black/15" />
            <div className="absolute inset-x-8 bottom-6 border-t-2 border-dashed border-white/40" />
            <CarFront
              className="relative size-24 text-white drop-shadow-[0_12px_20px_rgb(0_0_0/0.25)]"
              strokeWidth={1.25}
            />
            <span className="absolute end-4 top-4 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              {t('preview.tag')}
            </span>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-0.5">
              <p className="font-heading text-lg font-bold">{t('preview.category')}</p>
              <p className="text-sm text-muted-foreground">{t('preview.specs')}</p>
            </div>
            <ul className="grid gap-2 text-sm">
              <li className="flex items-center gap-2">
                <Plane className="size-4 shrink-0 text-primary rtl:-scale-x-100" />
                {t('places.tunisCarthage')}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-primary" />
                {t('preview.duration')}
              </li>
            </ul>
            <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
              <div className="grid gap-0.5">
                <span className="text-xs text-muted-foreground">{t('preview.total')}</span>
                <Money
                  millimes={PREVIEW_TOTAL_MILLIMES}
                  locale={locale}
                  className="font-heading text-xl font-extrabold"
                />
              </div>
              <Badge tone="success">{t('preview.payAtAgency')}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute start-0 top-[10.5rem] animate-float [animation-delay:-2.5s]">
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface/95 p-3 pe-4 shadow-elevated backdrop-blur">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
            <CircleCheck className="size-5" />
          </span>
          <div className="grid">
            <p className="text-sm font-semibold">{t('preview.confirmedTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('preview.confirmedText')}</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 end-0 animate-float [animation-delay:-5s]">
        <div className="flex max-w-[17rem] items-center gap-3 rounded-card border border-border bg-surface/95 p-3 pe-4 shadow-elevated backdrop-blur">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="size-5" />
          </span>
          <div className="grid">
            <p className="text-sm font-semibold">{t('preview.whatsappTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('preview.whatsappText')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

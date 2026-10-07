import { Button } from '@drivetn/ui/button';
import { Building2, MapPinned, Plane, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PageHero } from '@/components/client/page-hero';
import { Link } from '@/i18n/navigation';

export function AgenciesHero({
  governorates,
  airports,
  pickupPoints,
}: {
  governorates: number;
  airports: number;
  pickupPoints: number;
}) {
  const t = useTranslations('client.agencies');

  const stats = [
    { id: 'governorates', icon: MapPinned, value: governorates },
    { id: 'airports', icon: Plane, value: airports },
    { id: 'pickupPoints', icon: Building2, value: pickupPoints },
  ] as const;

  return (
    <PageHero
      id="agencies-title"
      icon={Building2}
      eyebrow={t('eyebrow')}
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button asChild variant="cta" size="lg" className="shadow-lg shadow-cta/25">
          <Link href="/search">
            <Search aria-hidden="true" />
            {t('findCar')}
          </Link>
        </Button>
      }
    >
      {pickupPoints > 0 && (
        <dl className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.id}
              className="flex items-center gap-4 rounded-panel border border-border bg-surface/80 p-4 shadow-soft backdrop-blur"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
                <stat.icon
                  className={stat.id === 'airports' ? 'size-6 rtl:-scale-x-100' : 'size-6'}
                  aria-hidden="true"
                />
              </span>
              <div className="grid">
                <dt className="order-2 text-sm text-muted-foreground">{t(`stats.${stat.id}`)}</dt>
                <dd className="order-1 font-heading text-2xl font-extrabold tabular-nums">
                  {stat.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </PageHero>
  );
}

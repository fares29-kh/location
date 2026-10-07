import { FileCheck2, ReceiptText, ShieldCheck, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SectionHeading } from '@/components/home/section-heading';

const COMMITMENTS = [
  { id: 'license', icon: FileCheck2, tone: 'bg-gradient-to-br from-primary to-info text-white' },
  { id: 'fleet', icon: ShieldCheck, tone: 'bg-success-soft text-success-soft-foreground' },
  { id: 'prices', icon: ReceiptText, tone: 'bg-cta-soft text-cta-soft-foreground' },
  { id: 'reviews', icon: Star, tone: 'bg-warning-soft text-warning-soft-foreground' },
] as const;

export function AgenciesCharter() {
  const t = useTranslations('client.agencies.charter');

  return (
    <section
      aria-labelledby="charter-title"
      className="border-y border-border bg-surface-muted/50 py-16 sm:py-24"
    >
      <div className="container">
        <SectionHeading
          id="charter-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          text={t('text')}
        />
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {COMMITMENTS.map((commitment, index) => (
            <li
              key={commitment.id}
              className="reveal relative grid content-start gap-4 overflow-hidden rounded-panel border border-border bg-surface p-6 shadow-soft transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-elevated"
            >
              <span
                aria-hidden="true"
                className="absolute end-5 top-4 font-heading text-5xl font-extrabold text-surface-muted"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={`relative flex size-12 items-center justify-center rounded-2xl shadow-soft ${commitment.tone}`}
              >
                <commitment.icon className="size-6" aria-hidden="true" />
              </span>
              <div className="relative grid gap-2">
                <h3 className="text-lg font-bold">{t(`${commitment.id}Title`)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`${commitment.id}Text`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

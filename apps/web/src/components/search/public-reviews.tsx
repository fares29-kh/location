'use client';

import { Rating } from '@drivetn/ui/rating';
import { useLocale, useTranslations } from 'next-intl';

import { usePublicReviews } from '@/lib/public-reviews';

function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(iso));
}

/** Avis déjà publiés de l'agence, affichés avant d'envoyer une demande. */
export function PublicReviews({ agencyId }: { agencyId: string }) {
  const t = useTranslations('client.booking.publicReviews');
  const locale = useLocale();
  const reviews = usePublicReviews(agencyId);
  const items = reviews.data ?? [];
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3" aria-label={t('title')}>
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      <ul className="grid gap-3">
        {items.slice(0, 3).map((review) => (
          <li
            key={review.id}
            className="grid gap-1 rounded-control border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{review.author}</p>
              <Rating value={review.rating} label={t('rating', { rating: review.rating })} />
            </div>
            <p className="text-pretty text-muted-foreground">{review.comment}</p>
            <p className="text-xs text-muted-foreground">
              <time dateTime={review.createdAt}>{formatDay(review.createdAt, locale)}</time>
            </p>
            {review.reply !== null && (
              <p className="border-s-2 border-primary ps-3 text-muted-foreground">
                <span className="font-medium text-foreground">{t('reply')} </span>
                {review.reply}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';

import type { ReviewModerationDecision } from '@drivetn/types';
import { Badge } from '@drivetn/ui/badge';
import { Card } from '@drivetn/ui/card';
import { Button } from '@drivetn/ui/button';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Rating } from '@drivetn/ui/rating';
import { toast } from '@drivetn/ui/toaster';
import { EyeOff, Flag, MessageSquareReply, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FilterTabs } from '@/components/agency/filter-tabs';
import { PageHeader } from '@/components/agency/page-header';
import { PaginationBar } from '@/components/agency/pagination-bar';
import { QueryError, TableSkeleton } from '@/components/agency/query-states';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import { Link } from '@/i18n/navigation';
import { useModeratedReviews, useModerateReview } from '@/lib/admin/queries';
import type { ModeratedReview, ReviewFilter } from '@/lib/admin/types';

import { useAdminPermission } from '../admin-session';
import { DecisionDialog } from '../decision-dialog';
import { personName } from '../person';
import { ReviewStatusTag } from '../status-tags';

const FILTERS: readonly ReviewFilter[] = ['flagged', 'published', 'hidden', 'all'];
const URL_DEFAULTS = { filter: 'flagged', page: '1' };
const HIDE_REASONS = ['insults', 'personalData', 'advertising'] as const;

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  if (key === 'filter') {
    return (FILTERS as readonly string[]).includes(value);
  }
  return /^\d+$/.test(value);
}

function ModerationActions({ review }: { review: ModeratedReview }) {
  const t = useTranslations('admin.reviews.actions');
  const allowed = useAdminPermission('reviews.moderate');
  const mutation = useModerateReview();
  const [hiding, setHiding] = useState(false);
  if (!allowed) {
    return null;
  }

  async function run(decision: ReviewModerationDecision, reason?: string) {
    try {
      await mutation.mutateAsync({ id: review.id, input: { decision, reason } });
      toast.success(t(`success.${decision}`));
      setHiding(false);
    } catch {
      toast.error(t('error'));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {review.status !== 'PUBLISHED' && (
        <Button
          size="sm"
          variant={review.status === 'FLAGGED' ? 'primary' : 'secondary'}
          loading={mutation.isPending && mutation.variables.input.decision === 'PUBLISH'}
          disabled={mutation.isPending}
          onClick={() => void run('PUBLISH')}
        >
          <ShieldCheck aria-hidden="true" />
          {t(review.status === 'FLAGGED' ? 'keep' : 'restore')}
        </Button>
      )}
      {review.status !== 'HIDDEN' && (
        <Button
          size="sm"
          variant={review.status === 'FLAGGED' ? 'danger' : 'secondary'}
          disabled={mutation.isPending}
          onClick={() => {
            setHiding(true);
          }}
        >
          <EyeOff aria-hidden="true" />
          {t('hide')}
        </Button>
      )}
      <DecisionDialog
        open={hiding}
        onOpenChange={setHiding}
        title={t('hideTitle')}
        description={t('hideText')}
        confirmLabel={t('hide')}
        destructive
        requireReason
        quickReasons={HIDE_REASONS.map((key) => t(`quickReasons.${key}`))}
        pending={mutation.isPending}
        onConfirm={(reason) => void run('HIDE', reason)}
      />
    </div>
  );
}

function ReviewCard({ review }: { review: ModeratedReview }) {
  const t = useTranslations('admin.reviews');
  const format = useAgencyFormat();
  const reports = review.reports.reduce((sum, report) => sum + report.count, 0);

  return (
    <Card
      className={cn(
        'grid gap-4 p-5',
        review.status === 'FLAGGED' && 'border-warning/50',
        review.status === 'HIDDEN' && 'bg-surface-muted/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-medium">
            {personName(review.author)}{' '}
            <span className="font-normal text-muted-foreground">
              {t('about')}{' '}
              <Link
                href={`/agencies?agency=${review.agency.id}`}
                className="text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {review.agency.name}
              </Link>
            </span>
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Rating value={review.rating} label={t('ratingLabel', { value: review.rating })} />
            <time dateTime={review.createdAt}>{format.date(review.createdAt)}</time>
          </div>
        </div>
        <ReviewStatusTag status={review.status} />
      </div>

      <p
        className={cn(
          'text-sm leading-relaxed',
          review.status === 'HIDDEN' &&
            'text-muted-foreground line-through decoration-muted-foreground/40',
        )}
      >
        {review.comment}
      </p>

      {review.agencyReply !== null && (
        <div className="flex gap-2 rounded-control bg-surface-muted p-3 text-sm">
          <MessageSquareReply
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p>
            <span className="font-medium">{t('agencyReply')} </span>
            {review.agencyReply}
          </p>
        </div>
      )}

      {reports > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning-soft-foreground">
            <Flag className="size-3.5" aria-hidden="true" />
            {t('reportsCount', { count: reports })}
          </span>
          {review.reports.map((report) => (
            <Badge key={report.reason} tone="warning">
              {t(`reasons.${report.reason}`)} · {report.count}
            </Badge>
          ))}
        </div>
      )}

      {review.status === 'HIDDEN' && review.moderationReason !== null && (
        <p className="text-xs text-muted-foreground">
          {t('hiddenBecause', { reason: review.moderationReason })}
          {review.moderatedAt !== null && ` · ${format.date(review.moderatedAt)}`}
        </p>
      )}

      <ModerationActions review={review} />
    </Card>
  );
}

export function ModerationView() {
  const t = useTranslations('admin.reviews');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const filter = params.filter as ReviewFilter;
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } =
    useModeratedReviews({ filter, page: Number(params.page) });

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <FilterTabs
        label={t('filterLabel')}
        value={filter}
        onValueChange={(value) => {
          setParams({ filter: value, page: '1' });
        }}
        options={FILTERS.map((value) => ({
          value,
          label: t(`filters.${value}`),
          count: data?.counts[value],
        }))}
      />

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={filter === 'flagged' ? t('emptyFlaggedTitle') : t('emptyTitle')}
          description={filter === 'flagged' ? t('emptyFlaggedText') : t('emptyText')}
        />
      ) : (
        <div
          className={cn('grid gap-4 transition-opacity', isPlaceholderData && 'opacity-60')}
          aria-busy={isPlaceholderData}
        >
          <ul className="grid gap-4">
            {data.items.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
          <PaginationBar
            data={data}
            onPageChange={(page) => {
              setParams({ page: String(page) });
            }}
          />
        </div>
      )}
    </div>
  );
}

'use client';

import { REVIEW_REPORT_REASONS, type ReviewReportReason } from '@drivetn/types';
import { Avatar, AvatarFallback, getInitials } from '@drivetn/ui/avatar';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Rating } from '@drivetn/ui/rating';
import { Skeleton } from '@drivetn/ui/skeleton';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { Flag, MessageSquareReply, MessagesSquare, Pencil, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Link } from '@/i18n/navigation';
import { useReplyToReview, useReportReview, useReviews } from '@/lib/agency/queries';
import { ApiError } from '@/lib/api/errors';
import {
  REVIEW_FILTERS,
  type Review,
  type ReviewFilter,
  type ReviewList,
} from '@/lib/agency/types';

import { FilterTabs } from '../filter-tabs';
import { PageHeader } from '../page-header';
import { PaginationBar } from '../pagination-bar';
import { QueryError } from '../query-states';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';

const REPLY_MAX_LENGTH = 1000;
const URL_DEFAULTS = { filter: 'all', page: '1' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  return key === 'page'
    ? /^\d+$/.test(value)
    : (REVIEW_FILTERS as readonly string[]).includes(value);
}

function RatingSummary({ data }: { data: ReviewList }) {
  const t = useTranslations('agency.reviews');
  const format = useAgencyFormat();
  const answered = data.count - data.unansweredCount;
  const max = Math.max(1, ...data.distribution);

  return (
    <Card className="grid gap-6 p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-10">
      <div className="grid justify-items-center gap-1 text-center md:justify-items-start md:text-start">
        <p className="font-heading text-3xl font-bold tabular-nums">
          {format.decimal(data.average)}
        </p>
        <Rating
          value={data.average}
          size="md"
          label={t('ratingLabel', { rating: format.decimal(data.average) })}
        />
        <p className="text-sm text-muted-foreground">{t('reviewsCount', { count: data.count })}</p>
      </div>

      <ul className="grid gap-1.5" aria-label={t('distributionLabel')}>
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = data.distribution[stars - 1] ?? 0;
          return (
            <li
              key={stars}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm"
            >
              <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                {stars}
                <Star className="size-3.5 text-amber-400" fill="currentColor" aria-hidden="true" />
              </span>
              <span
                className="h-2 overflow-hidden rounded-full bg-surface-muted"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </span>
              <span className="text-end tabular-nums text-muted-foreground">
                <span className="sr-only">{t('starsCount', { stars, count })}</span>
                <span aria-hidden="true">{format.integer(count)}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-1">
        <div className="rounded-control bg-surface-muted px-4 py-3">
          <dt className="text-xs text-muted-foreground">{t('responseRate')}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {format.percent(data.count === 0 ? 0 : answered / data.count)}
          </dd>
        </div>
        <div className="rounded-control bg-surface-muted px-4 py-3">
          <dt className="text-xs text-muted-foreground">{t('awaitingReply')}</dt>
          <dd
            className={cn(
              'text-lg font-semibold tabular-nums',
              data.unansweredCount > 0 && 'text-warning',
            )}
          >
            {format.integer(data.unansweredCount)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ReplyForm({ review, onDone }: { review: Review; onDone: () => void }) {
  const t = useTranslations('agency.reviews.reply');
  const id = useId();
  const mutation = useReplyToReview();
  const [value, setValue] = useState(review.reply ?? '');
  const [error, setError] = useState<string | null>(null);
  const firstName = review.customerName.split(' ')[0] ?? review.customerName;
  const templates =
    review.rating >= 4 ? (['thanks', 'welcomeBack'] as const) : (['apology', 'contact'] as const);

  return (
    <form
      noValidate
      className="grid gap-3 rounded-control border border-border bg-surface-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const reply = value.trim();
        if (reply.length === 0) {
          setError(t('required'));
          return;
        }
        if (reply.length > REPLY_MAX_LENGTH) {
          setError(t('tooLong', { max: REPLY_MAX_LENGTH }));
          return;
        }
        mutation.mutate(
          { id: review.id, reply },
          {
            onSuccess: () => {
              toast.success(t('success'));
              onDone();
            },
            onError: () => toast.error(t('error')),
          },
        );
      }}
    >
      <label htmlFor={`${id}-reply`} className="text-sm font-medium">
        {t('label')}
      </label>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template}
            type="button"
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setValue(t(`templates.${template}.text`, { name: firstName }));
              setError(null);
            }}
          >
            {t(`templates.${template}.label`)}
          </button>
        ))}
      </div>
      <Textarea
        id={`${id}-reply`}
        value={value}
        rows={4}
        maxLength={REPLY_MAX_LENGTH}
        placeholder={t('placeholder')}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={`${id}-hint${error === null ? '' : ` ${id}-error`}`}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span id={`${id}-hint`} className="text-muted-foreground">
          {t('hint')} ·{' '}
          <span className="tabular-nums">
            {value.length}/{REPLY_MAX_LENGTH}
          </span>
        </span>
        {error !== null && (
          <span id={`${id}-error`} className="font-medium text-danger" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" loading={mutation.isPending}>
          {review.reply === null ? t('submit') : t('update')}
        </Button>
      </div>
    </form>
  );
}

function ReportForm({ review, onDone }: { review: Review; onDone: () => void }) {
  const t = useTranslations('agency.reviews.report');
  const id = useId();
  const report = useReportReview();
  const [reason, setReason] = useState<ReviewReportReason>('OFFENSIVE');
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-control border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        report.mutate(
          { id: review.id, reason },
          {
            onSuccess: () => {
              toast.success(t('success'));
              onDone();
            },
            onError: (caught) => {
              const locked =
                caught instanceof ApiError &&
                caught.validationIssues.some((issue) => issue.message === 'ALREADY_REPORTED');
              setError(locked ? t('already') : t('error'));
            },
          },
        );
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t('label')}</legend>
        {REVIEW_REPORT_REASONS.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-reason`}
              value={value}
              checked={reason === value}
              onChange={() => {
                setReason(value);
              }}
            />
            {t(`reasons.${value}`)}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      {error !== null && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm" variant="secondary" loading={report.isPending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const t = useTranslations('agency.reviews');
  const format = useAgencyFormat();
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="text-xs">{getInitials(review.customerName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{review.customerName}</p>
            <p className="truncate text-xs text-muted-foreground">
              <Link
                href={`/bookings/${review.bookingId}`}
                className="hover:text-primary hover:underline"
              >
                {review.vehicleName}
              </Link>{' '}
              · <time dateTime={review.createdAt}>{format.relative(review.createdAt)}</time>
            </p>
          </div>
        </div>
        <Rating value={review.rating} label={t('ratingLabel', { rating: String(review.rating) })} />
      </div>

      <p className="text-pretty leading-relaxed">{review.comment}</p>

      {reporting ? (
        <ReportForm
          review={review}
          onDone={() => {
            setReporting(false);
          }}
        />
      ) : (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReporting(true);
              setEditing(false);
            }}
          >
            <Flag aria-hidden="true" />
            {t('report.open')}
          </Button>
        </div>
      )}

      {editing ? (
        <ReplyForm
          review={review}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : review.reply === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-dashed border-warning/50 bg-warning/5 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t('noReply')}</p>
          <Button
            size="sm"
            onClick={() => {
              setEditing(true);
            }}
          >
            <MessageSquareReply aria-hidden="true" />
            {t('replyAction')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 border-s-2 border-primary bg-primary/5 py-3 pe-3 ps-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-primary">
              {t('yourReply')}
              {review.repliedAt !== null && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · {format.date(review.repliedAt)}
                </span>
              )}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('editReply')}
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </div>
          <p className="text-sm leading-relaxed">{review.reply}</p>
        </div>
      )}
    </Card>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-44 rounded-card" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-40 rounded-card" />
      ))}
    </div>
  );
}

export function ReviewsView() {
  const t = useTranslations('agency.reviews');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const filter = params.filter as ReviewFilter;
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useReviews({
    filter,
    page: Number(params.page),
  });

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      {isPending ? (
        <ReviewsSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.count === 0 ? (
        <EmptyState icon={MessagesSquare} title={t('emptyTitle')} description={t('emptyText')} />
      ) : (
        <>
          <RatingSummary data={data} />
          <FilterTabs
            label={t('filterLabel')}
            value={filter}
            onValueChange={(value) => {
              setParams({ filter: value, page: '1' });
            }}
            options={REVIEW_FILTERS.map((value) => ({
              value,
              label: t(`filters.${value}`),
              count:
                value === 'all'
                  ? data.count
                  : value === 'unanswered'
                    ? data.unansweredCount
                    : undefined,
            }))}
          />
          {data.items.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title={t('emptyFilteredTitle')}
              description={t('emptyFilteredText')}
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
        </>
      )}
    </div>
  );
}

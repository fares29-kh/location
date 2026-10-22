'use client';

import {
  type CreateReviewInput,
  createReviewSchema,
  type CustomerBooking,
  REVIEW_COMMENT_MAX,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import { Field } from '@drivetn/ui/field';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { controlProps } from '@/components/auth/control-props';
import { ApiError } from '@/lib/api/errors';
import { useSubmitReview } from '@/lib/bookings';

const CODES = ['REQUIRED', 'TOO_SHORT', 'TOO_LONG', 'OUT_OF_RANGE', 'REVIEW_LOCKED'] as const;

function isCode(value: string): value is (typeof CODES)[number] {
  return (CODES as readonly string[]).includes(value);
}

export function ReviewDialog({
  booking,
  onOpenChange,
}: {
  booking: CustomerBooking;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('client.bookings.review');
  const tCommon = useTranslations('common');
  const id = useId();
  const submitReview = useSubmitReview();
  const existing = booking.review;
  const form = useForm<CreateReviewInput>({
    resolver: zodResolver(createReviewSchema),
    defaultValues: {
      rating: existing?.rating ?? 0,
      comment: existing?.comment ?? '',
    },
  });
  const ratingError = form.formState.errors.rating?.message;
  const commentError = form.formState.errors.comment?.message;
  const message = (code: string | undefined) =>
    code !== undefined && isCode(code) ? t(`validation.${code}`) : undefined;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon('close')} className="max-w-md">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              try {
                await submitReview.mutateAsync({ id: booking.id, input: values });
                toast.success(existing === null ? t('created') : t('updated'));
                onOpenChange(false);
              } catch (caught) {
                const issue =
                  caught instanceof ApiError
                    ? caught.validationIssues.find((item) => item.path === 'comment')
                    : undefined;
                if (issue !== undefined && isCode(issue.message)) {
                  form.setError('comment', { message: issue.message });
                  return;
                }
                toast.error(t('error'));
              }
            })(event);
          }}
        >
          <DialogHeader>
            <DialogTitle>{existing === null ? t('title') : t('editTitle')}</DialogTitle>
            <DialogDescription>
              {t('text', { agency: booking.agency.name, reference: booking.reference })}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">{t('rating')}</legend>
            <Controller
              control={form.control}
              name="rating"
              render={({ field }) => (
                <div role="radiogroup" aria-label={t('rating')} className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const selected = field.value >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={field.value === star}
                        aria-label={t('stars', { count: star })}
                        className="rounded-control p-1 text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          field.onChange(star);
                        }}
                      >
                        <Star
                          className="size-7"
                          fill={selected ? 'currentColor' : 'none'}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {message(ratingError) !== undefined && (
              <p className="text-sm text-destructive" role="alert">
                {message(ratingError)}
              </p>
            )}
          </fieldset>
          <Field id={`${id}-comment`} label={t('comment')} error={message(commentError)}>
            <Textarea
              {...controlProps(`${id}-comment`, { error: message(commentError) })}
              rows={4}
              maxLength={REVIEW_COMMENT_MAX}
              placeholder={t('placeholder')}
              {...form.register('comment')}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" loading={submitReview.isPending}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { type BookingAction, BOOKING_ACTIONS_WITH_REASON, getBookingActions } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { Field } from '@drivetn/ui/field';
import { cn } from '@drivetn/ui/lib/cn';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import {
  CalendarX2,
  Check,
  CircleSlash,
  Flag,
  KeyRound,
  type LucideIcon,
  MoreHorizontal,
  Undo2,
  UserX,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { useBookingTransition } from '@/lib/agency/queries';
import type { BookingView } from '@/lib/agency/types';

export const BOOKING_ACTION_ICONS: Record<BookingAction, LucideIcon> = {
  CONFIRM: Check,
  REJECT: CircleSlash,
  PICK_UP: KeyRound,
  RETURN: Undo2,
  COMPLETE: Flag,
  NO_SHOW: UserX,
  CANCEL: CalendarX2,
};

/** Actions rares ou irréversibles, regroupées dans le menu « Plus ». */
const SECONDARY_ACTIONS: readonly BookingAction[] = ['NO_SHOW', 'CANCEL'];
const DESTRUCTIVE_ACTIONS: readonly BookingAction[] = ['REJECT', 'NO_SHOW', 'CANCEL'];
const REJECT_REASONS = ['unavailable', 'dates', 'conditions'] as const;

/** Exécute une transition de réservation avec retour utilisateur (toast succès / erreur). */
export function useBookingActionRunner() {
  const t = useTranslations('agency.bookings.actions');
  const mutation = useBookingTransition();

  async function run(booking: BookingView, action: BookingAction, reason?: string) {
    try {
      await mutation.mutateAsync({ id: booking.id, input: { action, reason } });
      toast.success(t(`success.${action}`, { reference: booking.reference }));
      return true;
    } catch {
      toast.error(t('error'));
      return false;
    }
  }

  return {
    run,
    isPending: mutation.isPending,
    pendingAction: mutation.isPending ? mutation.variables.input.action : null,
  };
}

interface ConfirmState {
  action: BookingAction;
}

/** Fenêtre de confirmation : motif obligatoire (refus, annulation) ou simple confirmation. */
export function BookingActionDialog({
  booking,
  action,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  booking: BookingView;
  action: BookingAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => void;
  pending: boolean;
}) {
  const t = useTranslations('agency.bookings.actions');
  const tCommon = useTranslations('common');
  const id = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const needsReason = BOOKING_ACTIONS_WITH_REASON.includes(action);
  const reasonError = needsReason && touched && reason.trim().length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={tCommon('close')}>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (needsReason && reason.trim().length === 0) {
              return;
            }
            onConfirm(needsReason ? reason.trim() : undefined);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(`confirmTitle.${action}`, { reference: booking.reference })}
            </DialogTitle>
            <DialogDescription>{t(`confirmText.${action}`)}</DialogDescription>
          </DialogHeader>
          {needsReason && (
            <div className="grid gap-3">
              {action === 'REJECT' && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('quickReasons')}>
                  {REJECT_REASONS.map((key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 rounded-full"
                      onClick={() => {
                        setReason(t(`rejectReasons.${key}`));
                      }}
                    >
                      {t(`rejectReasons.${key}`)}
                    </Button>
                  ))}
                </div>
              )}
              <Field
                id={`${id}-reason`}
                label={t('reasonLabel')}
                hint={t('reasonHint')}
                error={reasonError ? t('reasonRequired') : undefined}
              >
                <Textarea
                  id={`${id}-reason`}
                  rows={3}
                  maxLength={300}
                  value={reason}
                  aria-invalid={reasonError || undefined}
                  aria-describedby={`${id}-reason-hint${reasonError ? ` ${id}-reason-error` : ''}`}
                  onChange={(event) => {
                    setReason(event.target.value);
                  }}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t('keep')}</Button>
            </DialogClose>
            <Button
              type="submit"
              variant={DESTRUCTIVE_ACTIONS.includes(action) ? 'danger' : 'primary'}
              loading={pending}
            >
              {t(`labels.${action}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Barre d'actions d'une réservation : action principale, alternatives et menu « Plus ». */
export function BookingActionsBar({
  booking,
  size = 'md',
  className,
}: {
  booking: BookingView;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = useTranslations('agency.bookings.actions');
  const runner = useBookingActionRunner();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const actions = getBookingActions(booking.status);
  if (actions.length === 0) {
    return null;
  }
  const visible = actions.filter((action) => !SECONDARY_ACTIONS.includes(action));
  const overflow = actions.filter((action) => SECONDARY_ACTIONS.includes(action));

  function trigger(action: BookingAction) {
    setConfirm({ action });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {[...visible].reverse().map((action, index, list) => {
        const Icon = BOOKING_ACTION_ICONS[action];
        const primary = index === list.length - 1;
        return (
          <Button
            key={action}
            size={size}
            variant={primary ? 'primary' : 'secondary'}
            loading={runner.pendingAction === action}
            disabled={runner.isPending}
            onClick={() => {
              trigger(action);
            }}
          >
            {runner.pendingAction !== action && <Icon aria-hidden="true" />}
            {t(`labels.${action}`)}
          </Button>
        );
      })}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size={size === 'sm' ? 'icon-sm' : 'icon'}
              aria-label={t('more')}
              disabled={runner.isPending}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map((action) => {
              const Icon = BOOKING_ACTION_ICONS[action];
              return (
                <DropdownMenuItem
                  key={action}
                  destructive
                  onSelect={() => {
                    trigger(action);
                  }}
                >
                  <Icon aria-hidden="true" />
                  {t(`labels.${action}`)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {confirm !== null && (
        <BookingActionDialog
          booking={booking}
          action={confirm.action}
          open
          pending={runner.isPending}
          onOpenChange={(open) => {
            if (!open) {
              setConfirm(null);
            }
          }}
          onConfirm={(reason) => {
            void runner.run(booking, confirm.action, reason).then((ok) => {
              if (ok) {
                setConfirm(null);
              }
            });
          }}
        />
      )}
    </div>
  );
}

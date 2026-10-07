'use client';

import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@drivetn/ui/sheet';
import { Skeleton } from '@drivetn/ui/skeleton';
import { toast } from '@drivetn/ui/toaster';
import { Ban, Building2, Mail, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { QueryError } from '@/components/agency/query-states';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { displayPhone } from '@/components/auth/otp-step';
import { Link } from '@/i18n/navigation';
import { useUser, useUserStatus } from '@/lib/admin/queries';
import type { UserDetail } from '@/lib/admin/types';

import { ActivityList } from '../activity';
import { useAdminPermission, useAdminSession } from '../admin-session';
import { DecisionDialog } from '../decision-dialog';
import { PersonIdentity, personName } from '../person';
import { RoleTag, UserStatusTag } from '../status-tags';

const SUSPEND_REASONS = ['fraud', 'abuse', 'request'] as const;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 rounded-control bg-surface-muted px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function StatusActions({ user }: { user: UserDetail }) {
  const t = useTranslations('admin.users.actions');
  const session = useAdminSession();
  const allowed = useAdminPermission('users.manage');
  const mutation = useUserStatus();
  const [open, setOpen] = useState(false);
  const suspended = user.status === 'SUSPENDED';
  const decision = suspended ? 'REACTIVATE' : 'SUSPEND';

  if (user.role === 'ADMIN' || user.id === session.id) {
    return <p className="text-sm text-muted-foreground">{t('adminManaged')}</p>;
  }
  if (!allowed) {
    return null;
  }

  async function run(reason?: string) {
    try {
      await mutation.mutateAsync({ id: user.id, input: { decision, reason } });
      toast.success(t(`success.${decision}`, { name: personName(user) }));
      setOpen(false);
    } catch {
      toast.error(t('error'));
    }
  }

  return (
    <>
      <Button
        variant={suspended ? 'primary' : 'danger'}
        onClick={() => {
          if (suspended) {
            void run();
          } else {
            setOpen(true);
          }
        }}
        loading={suspended && mutation.isPending}
      >
        {suspended ? <RotateCcw aria-hidden="true" /> : <Ban aria-hidden="true" />}
        {t(`labels.${decision}`)}
      </Button>
      <DecisionDialog
        open={open}
        onOpenChange={setOpen}
        title={t('confirmTitle', { name: personName(user) })}
        description={t('confirmText')}
        confirmLabel={t('labels.SUSPEND')}
        destructive
        requireReason
        quickReasons={SUSPEND_REASONS.map((key) => t(`quickReasons.${key}`))}
        pending={mutation.isPending}
        onConfirm={(reason) => void run(reason)}
      />
    </>
  );
}

function UserContent({ user }: { user: UserDetail }) {
  const t = useTranslations('admin.users.detail');
  const format = useAgencyFormat();
  const isCustomer = user.role === 'CUSTOMER';

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <PersonIdentity person={user} size="lg" />
        <div className="flex flex-wrap items-center gap-2">
          <RoleTag role={user.role} adminRole={user.adminRole} />
          <UserStatusTag status={user.status} />
        </div>
        {user.statusReason !== null && (
          <Alert tone="danger" title={t('reasonTitle')}>
            {user.statusReason}
          </Alert>
        )}
        <div>
          <StatusActions user={user} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Stat label={t('since')} value={format.date(user.createdAt)} />
        <Stat
          label={t('lastLogin')}
          value={user.lastLoginAt === null ? t('never') : format.relative(user.lastLoginAt)}
        />
        {isCustomer && <Stat label={t('bookings')} value={format.integer(user.bookingsCount)} />}
      </dl>

      <ul className="grid gap-2.5 text-sm">
        <li className="flex items-center gap-2.5">
          <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
          <a href={`tel:+216${user.phone}`} className="tabular-nums hover:text-primary">
            {displayPhone(user.phone)}
          </a>
        </li>
        <li className="flex items-center gap-2.5">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          {user.email === null ? (
            <span className="text-muted-foreground">{t('noEmail')}</span>
          ) : (
            <a
              href={`mailto:${user.email}`}
              className="truncate text-primary hover:underline"
              dir="ltr"
            >
              {user.email}
            </a>
          )}
        </li>
        {user.agency !== null && (
          <li className="flex items-center gap-2.5">
            <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <Link
              href={`/agencies?agency=${user.agency.id}`}
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user.agency.name}
            </Link>
            <span className="text-muted-foreground">· {user.agency.city}</span>
          </li>
        )}
        {user.adminRole !== null && (
          <li className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            {t(`adminScope.${user.adminRole}`)}
          </li>
        )}
      </ul>

      <section className="grid gap-3" aria-labelledby="user-activity">
        <h3 id="user-activity" className="text-sm font-semibold">
          {t('activity')}
        </h3>
        <ActivityList entries={user.activity} empty={t('noActivity')} />
      </section>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-14" />
      <Skeleton className="h-40" />
    </div>
  );
}

/** Fiche compte en panneau latéral ; l'identifiant vit dans l'URL (`?user=`). */
export function UserSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const t = useTranslations('admin.users.detail');
  const tCommon = useTranslations('common');
  // Garde le dernier compte affiché pendant l'animation de fermeture.
  const [shownId, setShownId] = useState(userId);
  if (userId !== null && userId !== shownId) {
    setShownId(userId);
  }
  const { data, isPending, isError, error, refetch, isFetching } = useUser(shownId);

  return (
    <Sheet
      open={userId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="end"
        closeLabel={tCommon('close')}
        className="w-full max-w-full gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-6 pe-14">
          <SheetTitle>{data === undefined ? t('title') : personName(data)}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {shownId === null || isPending ? (
            <DetailSkeleton />
          ) : isError ? (
            <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
          ) : (
            <UserContent user={data} />
          )}
        </div>
        <div className="border-t border-border p-4 sm:px-6">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

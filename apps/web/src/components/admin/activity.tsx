'use client';

import { cn } from '@drivetn/ui/lib/cn';
import {
  Banknote,
  Building2,
  CalendarCheck,
  CarFront,
  KeyRound,
  type LucideIcon,
  MessageSquareWarning,
  Receipt,
  ReceiptText,
  Settings,
  Tags,
  UserCog,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useNow } from '@/components/agency/use-now';
import {
  type AuditAction,
  type AuditCategory,
  auditCategory,
  type AuditEntry,
} from '@/lib/admin/types';

import { useAdminSession } from './admin-session';
import { personName } from './person';

export const AUDIT_CATEGORY_ICONS: Record<AuditCategory, LucideIcon> = {
  auth: KeyRound,
  agency: Building2,
  user: UserCog,
  booking: CalendarCheck,
  payment: Banknote,
  invoice: ReceiptText,
  review: MessageSquareWarning,
  settings: Settings,
  referential: Tags,
  vehicle: CarFront,
  expense: Receipt,
};

const SENSITIVE_ACTIONS: readonly AuditAction[] = [
  'auth.login_failed',
  'auth.refresh_token_reused',
  'agency.rejected',
  'agency.suspended',
  'user.suspended',
  'review.hidden',
  'vehicle.deleted',
  'expense.deleted',
];

const POSITIVE_ACTIONS: readonly AuditAction[] = [
  'agency.approved',
  'agency.reactivated',
  'user.reactivated',
  'invoice.paid',
  'review.published',
];

export function auditTone(action: AuditAction): 'danger' | 'success' | 'neutral' {
  if (SENSITIVE_ACTIONS.includes(action)) {
    return 'danger';
  }
  return POSITIVE_ACTIONS.includes(action) ? 'success' : 'neutral';
}

export function AuditIcon({ action, className }: { action: AuditAction; className?: string }) {
  const Icon = AUDIT_CATEGORY_ICONS[auditCategory(action)];
  const tone = auditTone(action);
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        tone === 'danger' && 'bg-danger-soft text-danger-soft-foreground',
        tone === 'success' && 'bg-success-soft text-success-soft-foreground',
        tone === 'neutral' && 'bg-surface-muted text-muted-foreground',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  );
}

/** Nom de l'auteur d'une action : « Vous », le système ou la personne. */
export function useActorLabel() {
  const t = useTranslations('admin.common');
  const session = useAdminSession();
  return (entry: AuditEntry) =>
    entry.actor === null
      ? t('system')
      : entry.actor.id === session.id
        ? t('you')
        : personName(entry.actor);
}

/** Fil chronologique compact d'entrées du journal d'audit. */
export function ActivityList({ entries, empty }: { entries: AuditEntry[]; empty: string }) {
  const t = useTranslations('admin.audit');
  const format = useAgencyFormat();
  const now = useNow();
  const actorLabel = useActorLabel();

  if (entries.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ol className="grid gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <AuditIcon action={entry.action} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="text-sm">
              <span className="font-medium">{t(`actions.${entry.action}`)}</span>
              {entry.target !== null && (
                <span className="text-muted-foreground"> · {entry.target}</span>
              )}
            </p>
            {entry.detail !== null && (
              <p className="line-clamp-2 border-s-2 border-border ps-2 text-xs text-muted-foreground">
                {entry.detail}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {actorLabel(entry)} ·{' '}
              <time dateTime={entry.createdAt} title={format.dateTime(entry.createdAt)}>
                {format.relative(entry.createdAt, new Date(now))}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

'use client';

import {
  type AgencyDecision,
  AGENCY_DECISIONS_WITH_REASON,
  getAgencyDecisions,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { toast } from '@drivetn/ui/toaster';
import { Ban, Check, CircleSlash, type LucideIcon, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAgencyDecision } from '@/lib/admin/queries';
import type { Agency } from '@/lib/admin/types';

import { useAdminPermission } from '../admin-session';
import { DecisionDialog } from '../decision-dialog';

const DECISION_ICONS: Record<AgencyDecision, LucideIcon> = {
  APPROVE: Check,
  REJECT: CircleSlash,
  SUSPEND: Ban,
  REACTIVATE: RotateCcw,
};

const QUICK_REASONS = {
  REJECT: ['documents', 'taxId', 'duplicate'],
  SUSPEND: ['complaints', 'insurance', 'unpaid'],
} as const;

/** Actions de validation, refus, suspension et réactivation d'une agence, selon son statut. */
export function AgencyDecisions({
  agency,
  size = 'md',
  className,
}: {
  agency: Agency;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = useTranslations('admin.agencies.decisions');
  const allowed = useAdminPermission('agencies.decide');
  const mutation = useAgencyDecision();
  const [confirm, setConfirm] = useState<AgencyDecision | null>(null);
  const decisions = getAgencyDecisions(agency.status);
  if (!allowed || decisions.length === 0) {
    return null;
  }

  async function run(decision: AgencyDecision, reason?: string) {
    try {
      await mutation.mutateAsync({ id: agency.id, input: { decision, reason } });
      toast.success(t(`success.${decision}`, { name: agency.name }));
      setConfirm(null);
    } catch {
      toast.error(t('error'));
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {[...decisions].reverse().map((decision, index, list) => {
        const Icon = DECISION_ICONS[decision];
        const primary = index === list.length - 1 && decision !== 'SUSPEND';
        return (
          <Button
            key={decision}
            size={size}
            variant={primary ? 'primary' : decision === 'SUSPEND' ? 'danger' : 'secondary'}
            disabled={mutation.isPending}
            onClick={() => {
              setConfirm(decision);
            }}
          >
            <Icon aria-hidden="true" />
            {t(`labels.${decision}`)}
          </Button>
        );
      })}
      {confirm !== null && (
        <DecisionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirm(null);
            }
          }}
          title={t(`confirmTitle.${confirm}`, { name: agency.name })}
          description={t(`confirmText.${confirm}`)}
          confirmLabel={t(`labels.${confirm}`)}
          destructive={confirm === 'REJECT' || confirm === 'SUSPEND'}
          requireReason={AGENCY_DECISIONS_WITH_REASON.includes(confirm)}
          quickReasons={
            confirm === 'REJECT'
              ? QUICK_REASONS.REJECT.map((key) => t(`quickReasons.REJECT.${key}`))
              : confirm === 'SUSPEND'
                ? QUICK_REASONS.SUSPEND.map((key) => t(`quickReasons.SUSPEND.${key}`))
                : []
          }
          pending={mutation.isPending}
          onConfirm={(reason) => void run(confirm, reason)}
        />
      )}
    </div>
  );
}

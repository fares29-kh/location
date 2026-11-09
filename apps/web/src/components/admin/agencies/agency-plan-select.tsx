'use client';

import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { toast } from '@drivetn/ui/toaster';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useSetAgencyPlan } from '@/lib/admin/queries';
import type { Agency } from '@/lib/admin/types';

import { useAdminPermission } from '../admin-session';

/** Change le plan d'abonnement (Starter, Business, Premium, Lifetime). */
export function AgencyPlanSelect({ agency }: { agency: Agency }) {
  const t = useTranslations('admin.agencies.plan');
  const tPlans = useTranslations('admin.plans');
  const allowed = useAdminPermission('billing.manage');
  const mutation = useSetAgencyPlan();
  const [draft, setDraft] = useState<SubscriptionPlan | null>(null);
  const plan = draft ?? agency.plan;

  if (!allowed) {
    return null;
  }

  async function save() {
    if (plan === agency.plan) {
      return;
    }
    try {
      await mutation.mutateAsync({ id: agency.id, input: { plan } });
      setDraft(null);
      toast.success(t('success', { name: agency.name, plan: tPlans(plan) }));
    } catch {
      setDraft(null);
      toast.error(t('error'));
    }
  }

  return (
    <div className="grid gap-2 rounded-control border border-border bg-surface-muted/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{t('title')}</p>
        <p className="text-xs text-muted-foreground">{tPlans(agency.plan)}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={plan}
          onValueChange={(value) => {
            setDraft(value as SubscriptionPlan);
          }}
          disabled={mutation.isPending}
        >
          <SelectTrigger className="min-w-44 flex-1" aria-label={t('title')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBSCRIPTION_PLANS.map((value) => (
              <SelectItem key={value} value={value}>
                {tPlans(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={mutation.isPending || plan === agency.plan}
          onClick={() => {
            void save();
          }}
        >
          {t('save')}
        </Button>
      </div>
    </div>
  );
}

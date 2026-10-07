'use client';

import type {
  AdminRole,
  AgencyStatus,
  InvoiceStatus,
  ReviewModerationStatus,
  SubscriptionPlan,
  UserRole,
  UserStatus,
} from '@drivetn/types';
import { Badge, type BadgeTone } from '@drivetn/ui/badge';
import { useTranslations } from 'next-intl';

function Dot() {
  return <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />;
}

const AGENCY_TONES: Record<AgencyStatus, BadgeTone> = {
  PENDING_REVIEW: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  REJECTED: 'neutral',
};

export function AgencyStatusTag({ status }: { status: AgencyStatus }) {
  const t = useTranslations('admin.status.agency');
  return (
    <Badge tone={AGENCY_TONES[status]}>
      <Dot />
      {t(status)}
    </Badge>
  );
}

const USER_TONES: Record<UserStatus, BadgeTone> = {
  PENDING_VERIFICATION: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
};

export function UserStatusTag({ status }: { status: UserStatus }) {
  const t = useTranslations('admin.status.user');
  return (
    <Badge tone={USER_TONES[status]}>
      <Dot />
      {t(status)}
    </Badge>
  );
}

const INVOICE_TONES: Record<InvoiceStatus, BadgeTone> = {
  ISSUED: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
};

export function InvoiceStatusTag({ status }: { status: InvoiceStatus }) {
  const t = useTranslations('admin.status.invoice');
  return (
    <Badge tone={INVOICE_TONES[status]}>
      <Dot />
      {t(status)}
    </Badge>
  );
}

const REVIEW_TONES: Record<ReviewModerationStatus, BadgeTone> = {
  PUBLISHED: 'success',
  FLAGGED: 'warning',
  HIDDEN: 'neutral',
};

export function ReviewStatusTag({ status }: { status: ReviewModerationStatus }) {
  const t = useTranslations('admin.status.review');
  return (
    <Badge tone={REVIEW_TONES[status]}>
      <Dot />
      {t(status)}
    </Badge>
  );
}

const ROLE_TONES: Record<UserRole, BadgeTone> = {
  CUSTOMER: 'neutral',
  AGENCY_OWNER: 'blue',
  AGENCY_STAFF: 'info',
  ADMIN: 'violet',
};

export function RoleTag({ role, adminRole }: { role: UserRole; adminRole: AdminRole | null }) {
  const t = useTranslations('admin.common');
  return (
    <Badge tone={ROLE_TONES[role]}>
      {adminRole === null ? t(`userRoles.${role}`) : t(`adminRoles.${adminRole}`)}
    </Badge>
  );
}

const PLAN_TONES: Record<SubscriptionPlan, BadgeTone> = {
  STARTER: 'neutral',
  PRO: 'primary',
  BUSINESS: 'violet',
};

export function PlanTag({ plan }: { plan: SubscriptionPlan }) {
  const t = useTranslations('admin.plans');
  return <Badge tone={PLAN_TONES[plan]}>{t(plan)}</Badge>;
}

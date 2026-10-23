-- Essai gratuit de 14 jours. Après ce délai, un abonnement impayé désactive le compte.

ALTER TABLE "agencies"
  ADD COLUMN "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN "billing_hold_from" "AgencyStatus";

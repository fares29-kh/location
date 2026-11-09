-- Plan choisi à l'inscription (Starter / Business), appliqué à la création de l'agence.
ALTER TABLE "users" ADD COLUMN "preferred_plan" "SubscriptionPlan";

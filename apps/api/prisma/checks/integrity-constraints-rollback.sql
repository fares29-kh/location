-- Retour arrière des migrations 20261008060000_integrity_constraints et
-- 20261008060100_validate_integrity_constraints.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f integrity-constraints-rollback.sql
--
-- Supprime les 20 contraintes (aucune donnée n'est modifiée) et retire les deux migrations de
-- l'historique Prisma, pour qu'un `prisma migrate deploy` ultérieur les rejoue. Une seule
-- transaction : tout ou rien. Chaque DROP prend un verrou ACCESS EXCLUSIVE bref (pas de parcours).
-- Le contrôle applicatif des chevauchements (customer-bookings.service.ts) reste actif.

BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE "bookings"
  DROP CONSTRAINT IF EXISTS "bookings_vehicle_no_overlap",
  DROP CONSTRAINT IF EXISTS "bookings_return_after_pickup_check",
  DROP CONSTRAINT IF EXISTS "bookings_daily_rate_positive_check",
  DROP CONSTRAINT IF EXISTS "bookings_total_nonnegative_check",
  DROP CONSTRAINT IF EXISTS "bookings_deposit_nonnegative_check";

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_rating_check";

ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_amount_positive_check";

ALTER TABLE "vehicles"
  DROP CONSTRAINT IF EXISTS "vehicles_daily_rate_positive_check",
  DROP CONSTRAINT IF EXISTS "vehicles_deposit_nonnegative_check",
  DROP CONSTRAINT IF EXISTS "vehicles_mileage_nonnegative_check",
  DROP CONSTRAINT IF EXISTS "vehicles_mileage_limit_positive_check",
  DROP CONSTRAINT IF EXISTS "vehicles_seats_positive_check";

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_amounts_nonnegative_check",
  DROP CONSTRAINT IF EXISTS "invoices_vat_rate_check",
  DROP CONSTRAINT IF EXISTS "invoices_due_after_issue_check",
  DROP CONSTRAINT IF EXISTS "invoices_total_check";

ALTER TABLE "agencies"
  DROP CONSTRAINT IF EXISTS "agencies_commission_check",
  DROP CONSTRAINT IF EXISTS "agencies_conditions_nonnegative_check";

ALTER TABLE "vehicle_photos" DROP CONSTRAINT IF EXISTS "vehicle_photos_dimensions_check";

ALTER TABLE "otp_codes" DROP CONSTRAINT IF EXISTS "otp_codes_attempts_check";

-- L'extension btree_gist est conservée : inoffensive, et d'autres objets pourraient l'utiliser.
-- Pour la retirer aussi (échoue si un objet en dépend encore) :
--   DROP EXTENSION IF EXISTS btree_gist;

DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN (
  '20261008060000_integrity_constraints',
  '20261008060100_validate_integrity_constraints'
);

-- Contrôle : 0 contrainte restante attendue.
SELECT count(*) AS remaining_constraints
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname IN (
    'bookings_vehicle_no_overlap', 'bookings_return_after_pickup_check',
    'bookings_daily_rate_positive_check', 'bookings_total_nonnegative_check',
    'bookings_deposit_nonnegative_check', 'reviews_rating_check', 'payments_amount_positive_check',
    'vehicles_daily_rate_positive_check', 'vehicles_deposit_nonnegative_check',
    'vehicles_mileage_nonnegative_check', 'vehicles_mileage_limit_positive_check',
    'vehicles_seats_positive_check', 'invoices_amounts_nonnegative_check',
    'invoices_vat_rate_check', 'invoices_due_after_issue_check', 'invoices_total_check',
    'agencies_commission_check', 'agencies_conditions_nonnegative_check',
    'vehicle_photos_dimensions_check', 'otp_codes_attempts_check'
  );

COMMIT;

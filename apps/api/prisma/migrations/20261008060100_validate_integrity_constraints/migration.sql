-- Vérifie les lignes existantes pour les CHECK ajoutés NOT VALID par la migration précédente.
-- VALIDATE CONSTRAINT prend un verrou SHARE UPDATE EXCLUSIVE : lectures et écritures continuent
-- pendant le parcours. Une ligne en infraction fait échouer la migration (23514) sans rien
-- modifier : la corriger après détection (prisma/checks/integrity-constraints-detection.sql).

SET lock_timeout = '10s';

ALTER TABLE "reviews" VALIDATE CONSTRAINT "reviews_rating_check";

ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_return_after_pickup_check";
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_daily_rate_positive_check";
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_total_nonnegative_check";
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_deposit_nonnegative_check";

ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_amount_positive_check";

ALTER TABLE "vehicles" VALIDATE CONSTRAINT "vehicles_daily_rate_positive_check";
ALTER TABLE "vehicles" VALIDATE CONSTRAINT "vehicles_deposit_nonnegative_check";
ALTER TABLE "vehicles" VALIDATE CONSTRAINT "vehicles_mileage_nonnegative_check";
ALTER TABLE "vehicles" VALIDATE CONSTRAINT "vehicles_mileage_limit_positive_check";
ALTER TABLE "vehicles" VALIDATE CONSTRAINT "vehicles_seats_positive_check";

ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_amounts_nonnegative_check";
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_vat_rate_check";
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_due_after_issue_check";
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_total_check";

ALTER TABLE "agencies" VALIDATE CONSTRAINT "agencies_commission_check";
ALTER TABLE "agencies" VALIDATE CONSTRAINT "agencies_conditions_nonnegative_check";

ALTER TABLE "vehicle_photos" VALIDATE CONSTRAINT "vehicle_photos_dimensions_check";

ALTER TABLE "otp_codes" VALIDATE CONSTRAINT "otp_codes_attempts_check";

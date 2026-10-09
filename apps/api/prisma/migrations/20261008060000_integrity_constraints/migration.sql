-- Contraintes d'intégrité : bornes (CHECK) et exclusion des réservations actives qui se
-- chevauchent sur un même véhicule.
--
-- Les CHECK sont ajoutés NOT VALID : verrou bref, sans parcours de la table ; ils s'appliquent
-- aussitôt aux insertions et mises à jour. Les lignes existantes sont vérifiées par la migration
-- suivante (VALIDATE CONSTRAINT), dans une transaction distincte, sous un verrou qui ne bloque ni
-- les lectures ni les écritures.
--
-- La contrainte d'exclusion n'accepte pas NOT VALID : son index GiST est construit ici, table
-- `bookings` verrouillée en écriture le temps de la construction.
--
-- Détection préalable (lecture seule) : prisma/checks/integrity-constraints-detection.sql.
-- Retour arrière : prisma/checks/integrity-constraints-rollback.sql.

-- Échoue vite plutôt que de bloquer le trafic derrière une transaction longue.
SET lock_timeout = '10s';

-- Égalité sur `vehicle_id` (text) dans un index GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- Avis
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;

-- Réservations
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_return_after_pickup_check" CHECK ("return_at" > "pickup_at") NOT VALID,
  ADD CONSTRAINT "bookings_daily_rate_positive_check" CHECK ("daily_rate_millimes" > 0) NOT VALID,
  ADD CONSTRAINT "bookings_total_nonnegative_check" CHECK ("total_millimes" >= 0) NOT VALID,
  ADD CONSTRAINT "bookings_deposit_nonnegative_check" CHECK ("deposit_millimes" >= 0) NOT VALID;

-- Encaissements : montant toujours positif, le sens (remboursement, restitution) vient de `kind`.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive_check" CHECK ("amount_millimes" > 0) NOT VALID;

-- Véhicules
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_daily_rate_positive_check" CHECK ("daily_rate_millimes" > 0) NOT VALID,
  ADD CONSTRAINT "vehicles_deposit_nonnegative_check" CHECK ("deposit_millimes" >= 0) NOT VALID,
  ADD CONSTRAINT "vehicles_mileage_nonnegative_check" CHECK ("mileage_km" >= 0) NOT VALID,
  ADD CONSTRAINT "vehicles_mileage_limit_positive_check"
    CHECK ("mileage_limit_km" IS NULL OR "mileage_limit_km" > 0) NOT VALID,
  ADD CONSTRAINT "vehicles_seats_positive_check" CHECK ("seats" > 0) NOT VALID;

-- Factures
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amounts_nonnegative_check" CHECK (
    "subscription_millimes" >= 0 AND "commission_millimes" >= 0 AND "subtotal_millimes" >= 0
    AND "vat_millimes" >= 0 AND "fiscal_stamp_millimes" >= 0 AND "total_millimes" >= 0
  ) NOT VALID,
  ADD CONSTRAINT "invoices_vat_rate_check" CHECK ("vat_rate_bps" BETWEEN 0 AND 10000) NOT VALID,
  ADD CONSTRAINT "invoices_due_after_issue_check" CHECK ("due_at" >= "issued_at") NOT VALID,
  ADD CONSTRAINT "invoices_total_check"
    CHECK ("total_millimes" = "subtotal_millimes" + "vat_millimes" + "fiscal_stamp_millimes")
    NOT VALID;

-- Agences
ALTER TABLE "agencies"
  ADD CONSTRAINT "agencies_commission_check"
    CHECK ("commission_bps" IS NULL OR "commission_bps" BETWEEN 0 AND 10000) NOT VALID,
  ADD CONSTRAINT "agencies_conditions_nonnegative_check" CHECK (
    "min_driver_age" >= 0 AND "min_license_years" >= 0 AND "free_cancellation_hours" >= 0
  ) NOT VALID;

-- Photos de véhicules
ALTER TABLE "vehicle_photos"
  ADD CONSTRAINT "vehicle_photos_dimensions_check"
    CHECK ("position" >= 0 AND "width" > 0 AND "height" > 0 AND "size_bytes" > 0) NOT VALID;

-- Codes à usage unique
ALTER TABLE "otp_codes"
  ADD CONSTRAINT "otp_codes_attempts_check" CHECK ("attempts" >= 0) NOT VALID;

-- Un véhicule ne peut avoir deux réservations actives sur des créneaux qui se chevauchent.
-- Statuts actifs = BLOCKING_BOOKING_STATUSES (@drivetn/types). Bornes [) : le retour d'une
-- location et le départ de la suivante peuvent tomber au même instant. Colonnes
-- `timestamp without time zone` (UTC) : tsrange, indépendant du fuseau de la session.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_vehicle_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, tsrange("pickup_at", "return_at", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'PICKED_UP'));

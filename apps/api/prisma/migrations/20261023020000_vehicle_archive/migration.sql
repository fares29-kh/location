-- Un véhicule retiré reste en base pour l'historique des locations.
-- Son immatriculation est libérée afin de pouvoir être réattribuée.

ALTER TABLE "vehicles"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "retired_plate_number" TEXT;

CREATE INDEX "vehicles_agency_id_deleted_at_idx" ON "vehicles"("agency_id", "deleted_at");

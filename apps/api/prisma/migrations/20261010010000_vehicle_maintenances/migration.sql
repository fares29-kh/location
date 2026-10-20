-- Entretiens planifiés : le véhicule est indisponible sur ces jours (recherche et réservations).
CREATE TABLE "vehicle_maintenances" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_maintenances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicle_maintenances_end_after_start_check" CHECK ("ends_at" > "starts_at")
);

CREATE INDEX "vehicle_maintenances_vehicle_id_starts_at_idx"
  ON "vehicle_maintenances"("vehicle_id", "starts_at");

ALTER TABLE "vehicle_maintenances"
  ADD CONSTRAINT "vehicle_maintenances_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deux entretiens d'un même véhicule ne se chevauchent pas (btree_gist : migration 20261008060000).
ALTER TABLE "vehicle_maintenances"
  ADD CONSTRAINT "vehicle_maintenances_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, tsrange("starts_at", "ends_at", '[)') WITH &&);

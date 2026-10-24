-- Lieux de remise propres à chaque véhicule.
-- Les voitures déjà en flotte restent proposées dans les lieux actifs du gouvernorat du bureau.

CREATE TABLE "vehicle_pickup_locations" (
    "vehicle_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,

    CONSTRAINT "vehicle_pickup_locations_pkey" PRIMARY KEY ("vehicle_id","location_id")
);

CREATE INDEX "vehicle_pickup_locations_location_id_idx" ON "vehicle_pickup_locations"("location_id");

ALTER TABLE "vehicle_pickup_locations"
    ADD CONSTRAINT "vehicle_pickup_locations_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_pickup_locations"
    ADD CONSTRAINT "vehicle_pickup_locations_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "vehicle_pickup_locations" ("vehicle_id", "location_id")
SELECT v."id", l."id"
FROM "vehicles" v
JOIN "agencies" a ON a."id" = v."agency_id"
JOIN "locations" l ON l."governorate_code" = a."governorate_code" AND l."is_active" = true
WHERE v."deleted_at" IS NULL;

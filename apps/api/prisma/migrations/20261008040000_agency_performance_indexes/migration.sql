-- Espace agence : index des requêtes ciblées (déclarés dans schema.prisma).
-- Déjà couverts par l'existant : (agency_id, status), (vehicle_id, pickup_at),
-- (customer_id, created_at), (agency_id, created_at) sur reviews, (booking_id) sur payments.

-- Planning, départs du jour, tri par date de départ.
CREATE INDEX "bookings_agency_id_pickup_at_idx" ON "bookings"("agency_id", "pickup_at");

-- Tri « plus récentes », KPIs mensuels, demandes en attente les plus anciennes.
CREATE INDEX "bookings_agency_id_created_at_idx" ON "bookings"("agency_id", "created_at");

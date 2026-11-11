-- Visibilité sur le site client : agence entière ou véhicule isolé.
ALTER TABLE "agencies" ADD COLUMN "listed_on_site" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "vehicles" ADD COLUMN "listed_on_site" BOOLEAN NOT NULL DEFAULT true;

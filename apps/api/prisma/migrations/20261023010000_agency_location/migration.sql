-- Position exacte d'une agence sur la carte publique. Les deux colonnes sont
-- renseignées ensemble, et seulement à l'intérieur de la Tunisie.

ALTER TABLE "agencies"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD CONSTRAINT "agencies_location_check" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR (
      "latitude" BETWEEN 30.2 AND 37.6
      AND "longitude" BETWEEN 7.5 AND 11.6
    )
  );

-- Numéros supplémentaires publiés par l'agence.

ALTER TABLE "agencies" ADD COLUMN "extra_phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

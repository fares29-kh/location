-- Nom d'agence choisi à l'inscription, appliqué à la création de la fiche.
ALTER TABLE "users" ADD COLUMN "preferred_agency_name" TEXT;

-- Recherche de l'espace agence insensible aux accents et à la casse (« hedi » trouve « Hédi »).
-- Prisma ne sait décrire ni les extensions (sans aperçu), ni les fonctions, ni les index sur
-- expression : ils n'existent que dans cette migration (absents de schema.prisma, ignorés par
-- `prisma migrate diff`).

-- Extensions « trusted » : installables par le propriétaire de la base, sans superutilisateur.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- `unaccent()` est STABLE (son dictionnaire est résolu via le search_path) : il ne peut pas
-- servir dans un index. Ce wrapper fige le dictionnaire et les schémas, ce qui le rend
-- réellement immutable, y compris pendant un pg_restore (search_path vide).
-- Ne touche ni à `%`, ni à `_`, ni à `\` : les motifs LIKE déjà échappés restent valides.
CREATE FUNCTION public.search_fold(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT pg_catalog.lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

-- Index trigrammes (LIKE '%…%'). Les expressions doivent rester identiques à celles de
-- `agency.queries.ts`, sinon PostgreSQL ne les utilise pas.
-- En production, sur une grosse table : CREATE INDEX CONCURRENTLY, hors transaction.
CREATE INDEX "users_name_search_idx" ON "users"
  USING gin (public.search_fold("first_name" || ' ' || "last_name") public.gin_trgm_ops);

CREATE INDEX "users_contact_search_idx" ON "users"
  USING gin (public.search_fold(COALESCE("email", '') || ' ' || COALESCE("city", '')) public.gin_trgm_ops);

CREATE INDEX "users_phone_search_idx" ON "users" USING gin ("phone" public.gin_trgm_ops);

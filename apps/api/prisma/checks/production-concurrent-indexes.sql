-- Production : objets des migrations 20261008040000_agency_performance_indexes et
-- 20261008050000_accent_insensitive_search créés SANS bloquer les écritures, avant
-- `prisma migrate deploy`. Prisma exécute chaque migration dans une transaction, où
-- CREATE INDEX CONCURRENTLY est interdit ; ces deux migrations sont ensuite marquées appliquées
-- (`prisma migrate resolve --applied`), sans être rejouées.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f production-concurrent-indexes.sql
--
-- Pas de BEGIN : chaque instruction s'exécute seule (autocommit), condition de CONCURRENTLY.
-- Idempotent : relançable après une interruption. Noms et expressions strictement identiques
-- aux migrations (sinon `agency.queries.ts` n'utilise pas les index et Prisma voit une dérive).

\set ON_ERROR_STOP on
SET statement_timeout = 0;
SET lock_timeout = '10s';

\echo '== Index invalides laissés par une construction interrompue (0 ligne attendue) =='
\echo '   Pour chacun : DROP INDEX CONCURRENTLY "<nom>"; puis relancer ce script.'
SELECT c.relname AS invalid_index
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE NOT i.indisvalid
  AND c.relname IN ('bookings_agency_id_pickup_at_idx', 'bookings_agency_id_created_at_idx',
                    'users_name_search_idx', 'users_contact_search_idx', 'users_phone_search_idx');

-- 20261008040000_agency_performance_indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_agency_id_pickup_at_idx"
  ON "bookings"("agency_id", "pickup_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookings_agency_id_created_at_idx"
  ON "bookings"("agency_id", "created_at");

-- 20261008050000_accent_insensitive_search
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.search_fold(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT pg_catalog.lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_name_search_idx" ON "users"
  USING gin (public.search_fold("first_name" || ' ' || "last_name") public.gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_contact_search_idx" ON "users"
  USING gin (public.search_fold(COALESCE("email", '') || ' ' || COALESCE("city", '')) public.gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_phone_search_idx" ON "users"
  USING gin ("phone" public.gin_trgm_ops);

\echo '== Contrôle : 5 index, tous valides =='
SELECT c.relname AS index_name, i.indisvalid AS is_valid
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname IN ('bookings_agency_id_pickup_at_idx', 'bookings_agency_id_created_at_idx',
                    'users_name_search_idx', 'users_contact_search_idx', 'users_phone_search_idx')
ORDER BY c.relname;

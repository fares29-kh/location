-- Détection, en lecture seule, des lignes qui empêcheraient d'ajouter les contraintes d'intégrité
-- (CHECK et exclusion des réservations actives qui se chevauchent).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f integrity-constraints-detection.sql
--
-- Tout s'exécute dans une transaction READ ONLY annulée à la fin : aucune écriture n'est
-- possible, aucun verrou bloquant n'est pris (lectures simples, comme un SELECT applicatif).

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '5s';

\echo
\echo '== 0. Prérequis =='

SELECT version();

SELECT current_user,
       r.rolsuper AS is_superuser,
       pg_get_userbyid(d.datdba) AS database_owner
FROM pg_database d
JOIN pg_roles r ON r.rolname = current_user
WHERE d.datname = current_database();

-- btree_gist doit être disponible (paquet contrib) ; « trusted » depuis PostgreSQL 13.
SELECT e.name, e.default_version, e.installed_version, v.trusted
FROM pg_available_extensions e
JOIN pg_available_extension_versions v ON v.name = e.name AND v.version = e.default_version
WHERE e.name IN ('btree_gist', 'pg_trgm', 'unaccent')
ORDER BY e.name;

-- Prisma crée `timestamp(3) without time zone` : la contrainte utilisera tsrange (pas tstzrange).
SELECT column_name, data_type, datetime_precision
FROM information_schema.columns
WHERE table_schema = current_schema() AND table_name = 'bookings'
  AND column_name IN ('pickup_at', 'return_at')
ORDER BY column_name;

-- Index de recherche de l'étape A : présents et valides (indisvalid = false après un
-- CREATE INDEX CONCURRENTLY interrompu). Aucune ligne avant production-concurrent-indexes.sql.
SELECT c.relname AS index_name, i.indisvalid AS is_valid, i.indisready AS is_ready
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN ('users_name_search_idx', 'users_contact_search_idx', 'users_phone_search_idx')
ORDER BY c.relname;

-- Volumétrie : durée des VALIDATE et de la construction de l'index d'exclusion.
SELECT relname AS table_name, n_live_tup AS approx_rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE relname IN ('bookings', 'payments', 'reviews', 'vehicles', 'invoices', 'agencies',
                  'vehicle_photos', 'otp_codes')
ORDER BY relname;

\echo
\echo '== 1. Contraintes CHECK : lignes en infraction (0 attendu partout) =='

SELECT check_name, violations, sample_ids
FROM (
  SELECT 'reviews: rating entre 1 et 5' AS check_name, count(*) AS violations,
         (array_agg(id ORDER BY id))[1:5] AS sample_ids
  FROM reviews WHERE NOT (rating BETWEEN 1 AND 5)
  UNION ALL
  SELECT 'bookings: return_at > pickup_at', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM bookings WHERE NOT (return_at > pickup_at)
  UNION ALL
  SELECT 'bookings: daily_rate_millimes >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM bookings WHERE daily_rate_millimes < 0
  UNION ALL
  SELECT 'bookings: total_millimes >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM bookings WHERE total_millimes < 0
  UNION ALL
  SELECT 'bookings: deposit_millimes >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM bookings WHERE deposit_millimes < 0
  UNION ALL
  SELECT 'payments: amount_millimes > 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM payments WHERE amount_millimes <= 0
  UNION ALL
  SELECT 'vehicles: daily_rate_millimes >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM vehicles WHERE daily_rate_millimes < 0
  UNION ALL
  SELECT 'vehicles: deposit_millimes >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM vehicles WHERE deposit_millimes < 0
  UNION ALL
  SELECT 'vehicles: mileage_km >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM vehicles WHERE mileage_km < 0
  UNION ALL
  SELECT 'vehicles: mileage_limit_km NULL ou > 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM vehicles WHERE mileage_limit_km <= 0
  UNION ALL
  SELECT 'vehicles: seats > 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM vehicles WHERE seats <= 0
  UNION ALL
  SELECT 'invoices: montants >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM invoices
  WHERE subscription_millimes < 0 OR commission_millimes < 0 OR subtotal_millimes < 0
     OR vat_millimes < 0 OR fiscal_stamp_millimes < 0 OR total_millimes < 0
  UNION ALL
  SELECT 'invoices: vat_rate_bps entre 0 et 10000', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM invoices WHERE NOT (vat_rate_bps BETWEEN 0 AND 10000)
  UNION ALL
  SELECT 'invoices: due_at >= issued_at', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM invoices WHERE due_at < issued_at
  UNION ALL
  SELECT 'agencies: commission_bps NULL ou entre 0 et 10000', count(*),
         (array_agg(id ORDER BY id))[1:5]
  FROM agencies WHERE NOT (commission_bps BETWEEN 0 AND 10000)
  UNION ALL
  SELECT 'agencies: âge, ancienneté de permis, délai d''annulation >= 0', count(*),
         (array_agg(id ORDER BY id))[1:5]
  FROM agencies
  WHERE min_driver_age < 0 OR min_license_years < 0 OR free_cancellation_hours < 0
  UNION ALL
  SELECT 'invoices: total = sous-total + TVA + timbre', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM invoices
  WHERE total_millimes <> subtotal_millimes + vat_millimes + fiscal_stamp_millimes
  UNION ALL
  SELECT 'otp_codes: attempts >= 0', count(*), (array_agg(id ORDER BY id))[1:5]
  FROM otp_codes WHERE attempts < 0
) checks
ORDER BY violations DESC, check_name;

-- `vehicle_photos` n'existe qu'à partir de la migration 20261008030000_vehicle_photos.
SELECT to_regclass('public.vehicle_photos') IS NOT NULL AS has_vehicle_photos \gset
\if :has_vehicle_photos
SELECT 'vehicle_photos: position >= 0, dimensions et taille > 0' AS check_name,
       count(*) AS violations, (array_agg(id ORDER BY id))[1:5] AS sample_ids
FROM vehicle_photos WHERE position < 0 OR width <= 0 OR height <= 0 OR size_bytes <= 0;
\else
\echo 'vehicle_photos : table absente (migration 20261008030000 pas encore appliquée), rien à vérifier.'
\endif

\echo
\echo '== 2. Exclusion : réservations actives (PENDING, CONFIRMED, PICKED_UP) qui se chevauchent sur un même véhicule =='

-- Comparaisons simples plutôt que tsrange : ne plante pas sur une réservation aux dates
-- inversées (comptée au point 1). Équivalent à `tsrange(...,'[)') && tsrange(...,'[)')`.
SELECT count(*) AS overlapping_pairs,
       count(DISTINCT a.vehicle_id) AS vehicles,
       count(DISTINCT a.agency_id) AS agencies
FROM bookings a
JOIN bookings b ON b.vehicle_id = a.vehicle_id AND a.id < b.id
WHERE a.status IN ('PENDING', 'CONFIRMED', 'PICKED_UP')
  AND b.status IN ('PENDING', 'CONFIRMED', 'PICKED_UP')
  AND a.pickup_at < b.return_at
  AND b.pickup_at < a.return_at;

SELECT a.agency_id, a.vehicle_id,
       a.reference AS reference_a, a.status AS status_a, a.pickup_at AS pickup_a,
       a.return_at AS return_a, a.created_at AS created_a,
       b.reference AS reference_b, b.status AS status_b, b.pickup_at AS pickup_b,
       b.return_at AS return_b, b.created_at AS created_b
FROM bookings a
JOIN bookings b ON b.vehicle_id = a.vehicle_id AND a.id < b.id
WHERE a.status IN ('PENDING', 'CONFIRMED', 'PICKED_UP')
  AND b.status IN ('PENDING', 'CONFIRMED', 'PICKED_UP')
  AND a.pickup_at < b.return_at
  AND b.pickup_at < a.return_at
ORDER BY a.agency_id, a.vehicle_id, a.pickup_at
LIMIT 100;

\echo
\echo '== 3. Informations (pas des infractions) =='

-- Montants à 0 : décident entre « >= 0 » et « > 0 ».
SELECT 'bookings: daily_rate_millimes = 0' AS info, count(*) AS rows
FROM bookings WHERE daily_rate_millimes = 0
UNION ALL
SELECT 'bookings: total_millimes = 0', count(*) FROM bookings WHERE total_millimes = 0
UNION ALL
SELECT 'vehicles: daily_rate_millimes = 0', count(*) FROM vehicles WHERE daily_rate_millimes = 0
UNION ALL
-- Retour et départ au même instant sur un véhicule : autorisés par les bornes [).
SELECT 'réservations actives enchaînées (retour = départ suivant)', count(*)
FROM bookings a
JOIN bookings b ON b.vehicle_id = a.vehicle_id AND b.pickup_at = a.return_at
WHERE a.status IN ('PENDING', 'CONFIRMED', 'PICKED_UP')
  AND b.status IN ('PENDING', 'CONFIRMED', 'PICKED_UP')
UNION ALL
-- Réservations sorties dont le retour prévu est passé : elles bloquent toujours le véhicule.
SELECT 'PICKED_UP dont return_at est passé', count(*)
FROM bookings WHERE status = 'PICKED_UP' AND return_at < now() AT TIME ZONE 'UTC';

-- Bornes [) : deux locations enchaînées ne se chevauchent pas, deux locations qui partagent
-- une heure si (attendu : false, true).
SELECT tsrange('2026-01-01 10:00', '2026-01-02 10:00', '[)')
         && tsrange('2026-01-02 10:00', '2026-01-03 10:00', '[)') AS adjacent_overlaps,
       tsrange('2026-01-01 10:00', '2026-01-02 10:00', '[)')
         && tsrange('2026-01-02 09:00', '2026-01-03 10:00', '[)') AS one_hour_overlaps;

ROLLBACK;

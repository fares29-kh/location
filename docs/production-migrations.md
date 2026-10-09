# Mise en production des migrations de la Phase 2

Procédure pour passer une base de production de `20261008020000_admin_platform` (dernière
migration livrée) aux migrations suivantes :

| Migration                                       | Contenu                                                          | Mode en production                      |
| ----------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `20261008030000_vehicle_photos`                 | table `vehicle_photos`                                           | `migrate deploy`                        |
| `20261008040000_agency_performance_indexes`     | 2 index sur `bookings`                                           | à la main, `CONCURRENTLY`, puis resolve |
| `20261008050000_accent_insensitive_search`      | extensions `unaccent`, `pg_trgm`, `search_fold`, 3 index `users` | à la main, `CONCURRENTLY`, puis resolve |
| `20261008060000_integrity_constraints`          | `btree_gist`, 19 CHECK `NOT VALID`, exclusion des chevauchements | `migrate deploy`                        |
| `20261008060100_validate_integrity_constraints` | `VALIDATE CONSTRAINT` des 19 CHECK                               | `migrate deploy`                        |

Prisma exécute chaque fichier de migration dans une transaction : `CREATE INDEX CONCURRENTLY` y
est interdit. Les index sont donc créés à la main, sans bloquer les écritures, puis les deux
migrations correspondantes sont marquées appliquées. Répétée de bout en bout sur une base dans
l'état de la production : `migrate status` à jour, `migrate diff` sans différence, 20 contraintes
validées.

Scripts (dossier `apps/api/prisma/checks/`) :

- `integrity-constraints-detection.sql` : détection en lecture seule ;
- `production-concurrent-indexes.sql` : index de l'étape A, hors transaction, relançable ;
- `integrity-constraints-rollback.sql` : retour arrière des contraintes.

Dans les commandes ci-dessous, `$DATABASE_URL` est l'URL de la base de production. Depuis le
serveur, `psql` peut aussi passer par le conteneur PostgreSQL :
`docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f - < fichier.sql`.

## Prérequis

- PostgreSQL 13 ou plus (`btree_gist`, `pg_trgm` et `unaccent` sont « trusted » : le propriétaire
  de la base les installe sans superutilisateur). Paquet `contrib` présent (inclus dans les images
  officielles). Vérifié par la section 0 du script de détection.
- `pg_dump` / `pg_restore` de même version majeure que le serveur, ou plus récente.
- Espace disque pour la sauvegarde.
- Le code de la nouvelle version (dossier `apps/api/prisma/migrations` à jour) pour `migrate
resolve` et `migrate deploy`.
- L'entrypoint de l'API applique `prisma migrate deploy` au démarrage si `RUN_MIGRATIONS=true`.
  Dans ce cas, les étapes 1 à 5 doivent être terminées **avant** de démarrer la nouvelle image :
  sinon le démarrage créerait les index de l'étape A sans `CONCURRENTLY`, tables verrouillées.

## Fenêtre conseillée

- Entre 2 h et 5 h, heure de Tunis, du mardi au jeudi : trafic minimal, loin des pics du
  week-end et des vacances.
- Pas le 1er du mois ni la veille (émission des factures mensuelles), et loin de 7 h (tâche
  quotidienne d'émission des factures).
- Durée à prévoir : celle de la sauvegarde et du test de restauration, plus quelques secondes
  pour les migrations (mesures en fin de document). Les verrous forts ne durent qu'une fraction
  de seconde par table ; la seule attente possible vient d'une transaction longue en cours
  (`lock_timeout` de 10 s, voir « En cas d'échec »).

## 1. Détection (lecture seule)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/checks/integrity-constraints-detection.sql
```

Transaction `READ ONLY` annulée à la fin : aucune écriture possible.

- Section 0 : `btree_gist`, `pg_trgm` et `unaccent` présents ; colonnes `timestamp without time
zone`. Les index de l'étape A n'apparaissent qu'après l'étape 3.
- Section 1 : nombre de lignes en infraction par contrainte. **Tout doit valoir 0.** Sinon,
  `prisma/migrations/20261008060100_validate_integrity_constraints` échouerait (23514) : arrêter,
  examiner les identifiants affichés et faire valider une correction ligne par ligne. Aucune
  correction automatique.
- Section 2 : paires de réservations actives (`PENDING`, `CONFIRMED`, `PICKED_UP`) qui se
  chevauchent sur un véhicule. **0 attendu.** Chaque paire est une double réservation réelle :
  l'agence choisit laquelle annuler ou décaler ; sinon la migration
  `20261008060000_integrity_constraints` échoue (23P01) sans rien modifier.
- Section 3 : informations (montants à 0, locations enchaînées, véhicules sortis en retard).

## 2. Sauvegarde et test de restauration

```bash
STAMP=$(date -u +%Y%m%dT%H%MZ)
pg_dump --format=custom --no-owner --file="drivetn-$STAMP.dump" "$DATABASE_URL"
pg_restore --list "drivetn-$STAMP.dump" > /dev/null   # archive lisible

# Restauration complète dans une base jetable (autre serveur de préférence).
createdb --maintenance-db="$RESTORE_ADMIN_URL" drivetn_restore_check
pg_restore --no-owner --exit-on-error --dbname="$RESTORE_URL" "drivetn-$STAMP.dump"
```

Comparer le nombre de lignes par table sur la production et sur la copie (identique, aux
écritures intervenues depuis la sauvegarde près) :

```sql
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(
         format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, ''
       )))[1]::text::bigint AS row_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

`_prisma_migrations` doit être identique. Puis `dropdb drivetn_restore_check`. Conserver
l'archive hors du serveur de base jusqu'à la fin de la période d'observation.

## 3. Index de l'étape A, sans bloquer les écritures

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/checks/production-concurrent-indexes.sql
```

Sans `--single-transaction` ni `-1` : chaque `CREATE INDEX CONCURRENTLY` doit s'exécuter seul.
Le script liste d'abord les index invalides (construction interrompue) : pour chacun,
`DROP INDEX CONCURRENTLY "<nom>";` puis relancer le script. Il se termine par le contrôle des
5 index, tous `is_valid = t`. L'application en cours continue de fonctionner pendant ce temps.

## 4. Marquer les deux migrations d'index comme appliquées

```bash
cd apps/api
npx prisma migrate resolve --applied 20261008040000_agency_performance_indexes
npx prisma migrate resolve --applied 20261008050000_accent_insensitive_search
```

Avec `DATABASE_URL` pointant sur la production. Vérifié : `migrate deploy` applique ensuite
normalement `20261008030000_vehicle_photos`, antérieure mais encore en attente.

## 5. Déploiement des migrations

```bash
npx prisma migrate deploy
```

Applique `20261008030000_vehicle_photos`, `20261008060000_integrity_constraints` (CHECK
`NOT VALID`, verrou bref ; contrainte d'exclusion, index GiST construit sous verrou) puis
`20261008060100_validate_integrity_constraints` (verrou `SHARE UPDATE EXCLUSIVE` : lectures et
écritures continuent). Avec l'image de la nouvelle version, l'équivalent est
`docker compose run --rm --no-deps -e RUN_MIGRATIONS=true -e SEED_ON_START=false api true`.

## 6. Contrôles

```bash
npx prisma migrate status    # « Database schema is up to date! »
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/checks/integrity-constraints-detection.sql
```

`migrate diff` doit répondre « No difference detected » (Prisma ignore les CHECK, l'exclusion,
les fonctions et les index sur expression ; `users_phone_search_idx` est déclaré dans le schéma).
Contraintes en place et validées (19 CHECK, 1 exclusion) :

```sql
SELECT contype, count(*), bool_and(convalidated) AS validated
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND (conname LIKE '%\_check' OR conname = 'bookings_vehicle_no_overlap')
GROUP BY contype;
```

## 7. Démarrage de la nouvelle version

Démarrer l'API et le worker de la nouvelle image (avec `RUN_MIGRATIONS=true`, le `migrate deploy`
du démarrage ne trouve plus rien à appliquer). Surveiller dans les journaux de l'API les
avertissements `Contrainte … (SQLSTATE …)` : une contrainte atteinte malgré les contrôles
applicatifs répond 409, jamais 500, et mérite une analyse.

## En cas d'échec

- **`lock_timeout` (55P03) pendant `migrate deploy`** : une transaction longue tenait un verrou.
  La migration est annulée (rien n'est appliqué) et marquée en échec dans `_prisma_migrations`.
  Identifier la transaction (`pg_stat_activity`), puis
  `npx prisma migrate resolve --rolled-back <migration>` et relancer `migrate deploy`.
- **23514 ou 23P01 pendant la migration** : des données ont changé depuis la détection. Même
  marche : `resolve --rolled-back`, relancer la détection, faire valider les corrections, puis
  `migrate deploy`.
- **Échec de `VALIDATE` seul** : les CHECK restent `NOT VALID` mais protègent déjà toutes les
  nouvelles écritures ; la validation peut être rejouée après correction.

## Retour arrière

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/checks/integrity-constraints-rollback.sql
```

Une transaction : supprime les 20 contraintes (aucune donnée modifiée), conserve l'extension
`btree_gist`, retire `20261008060000` et `20261008060100` de `_prisma_migrations` pour qu'un
`migrate deploy` ultérieur les rejoue. Le contrôle applicatif des chevauchements reste actif.
Testé : retour arrière puis nouveau `migrate deploy` sans différence de schéma.

Les index de l'étape A n'ont pas besoin de retour arrière (sans effet sur les écritures hormis
leur maintenance). Si nécessaire : `DROP INDEX CONCURRENTLY` de chacun, puis supprimer les lignes
des deux migrations dans `_prisma_migrations`.

## Durées mesurées

Base de perf (PostgreSQL 16 en Docker sous Windows) : 40 000 réservations dont 8 163 actives,
82 010 encaissements, 8 145 avis, 10 011 utilisateurs.

| Opération                                   |        Durée | Verrou                                                      |
| ------------------------------------------- | -----------: | ----------------------------------------------------------- |
| 5 index `CONCURRENTLY` (étape 3)            |     ~ 200 ms | aucun blocage des écritures                                 |
| `CREATE EXTENSION btree_gist`               |   48 à 88 ms | —                                                           |
| 19 CHECK `NOT VALID`                        |    5 à 15 ms | `ACCESS EXCLUSIVE`, sans parcours                           |
| Contrainte d'exclusion (index GiST partiel) | 368 à 379 ms | `ACCESS EXCLUSIVE` sur `bookings` (lectures comprises)      |
| Migration `20261008060000` complète         |     ~ 430 ms | 8 tables en `ACCESS EXCLUSIVE` jusqu'à la fin               |
| Migration `20261008060100` (19 `VALIDATE`)  |      ~ 30 ms | `SHARE UPDATE EXCLUSIVE` : lectures et écritures continuent |

L'index d'exclusion ne contient que les réservations actives : sa durée suit leur nombre, pas
celui de l'historique (environ 45 ms pour 1 000 réservations actives sur ce poste).

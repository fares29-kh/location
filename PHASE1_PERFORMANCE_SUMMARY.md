# Phase 1 — Lectures ciblées de l'espace agence

## Ce qui a changé

L'ancien `load()` chargeait toute l'agence (véhicules, réservations, événements, paiements,
clients, avis) à chaque requête, puis `createAgencyQueries` calculait les vues en mémoire.
Chaque lecture de `AgencyService` est maintenant une requête ciblée, toujours filtrée sur
l'`agencyId` déduit du gérant connecté :

- pagination en base (`skip`/`take`, page hors bornes ramenée sur la dernière page) ;
- filtres, tris (avec l'identifiant comme départage) et recherche en PostgreSQL ;
- agrégats SQL pour le tableau de bord, la synthèse des encaissements, les stats véhicules et
  clients ;
- sélection minimale des clients (`CUSTOMER_SELECT`, jamais `passwordHash`) ;
- pas de N+1 : les requêtes d'un même écran partent en un seul lot.

Fichiers : `apps/api/src/agency/agency.{service,queries,mapper}.ts`,
`apps/api/src/common/pagination.ts`, `packages/types/src/agency-portal.ts` (paramètre `limit`).

## Contrat d'API

Les formes de réponse sont inchangées (`Paginated<T>` : `items, total, page, pageSize,
pageCount`). Changements :

| Point                                   | Avant                                          | Après                                                          |
| --------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `limit` (bookings, customers, payments) | absent                                         | facultatif, défaut 20, max 100 (au-delà : 100 ; invalide : 20) |
| Taille de page par défaut               | 10 (réservations, clients), 12 (encaissements) | 20 partout (le front lit `pageSize` dans la réponse)           |
| `vehicle.photos` dans une réservation   | toutes les photos                              | la couverture seule (vignette)                                 |
| Ordre des véhicules du planning         | ordre d'insertion                              | marque puis modèle                                             |

Avis et flotte restent non paginés (contrat existant ; avis paginés en Phase 2, étape B).

## Index (migration `20261008040000_agency_performance_indexes`)

La première version créait `idx_bookings_agency_status`, doublon de l'index existant
`bookings_agency_id_status_idx`, et des index absents de `schema.prisma` (dérive de schéma).
Elle ne contient plus que deux index, déclarés aussi dans le schéma :

- `bookings (agency_id, pickup_at)` : planning, départs du jour, tri par départ ;
- `bookings (agency_id, created_at)` : tri « plus récentes », KPIs du mois, demandes en attente.

Déjà couverts : `(agency_id, status)`, `(vehicle_id, pickup_at)`, `(customer_id, created_at)`,
`reviews (agency_id, created_at)`, `payments (booking_id)`. Vérifié sur une base migrée :
`prisma migrate diff --exit-code` ne détecte aucune différence.

## Pool de connexions (`getDashboard`)

La version intermédiaire lançait ~10 requêtes en parallèle (`Promise.all`) puis 6 en série :
jusqu'à ~10 connexions du pool par affichage du tableau de bord. Désormais, les 8 requêtes partent
dans un seul `$transaction([...])` : une connexion par affichage, en `RepeatableRead` pour que
tous les indicateurs viennent du même instantané. Même principe pour les compteurs de navigation
(interrogés chaque minute), les listes et la flotte. Le coût (requêtes en série sur une connexion)
est mesuré ci-dessous : 137 ms au p50 pour une agence de 20 000 réservations.

## Mesures

Commande (base jetable dont le nom finit par `_test` ou `_perf`, vidée puis remplie) :

```bash
PERF_DATABASE_URL=postgresql://…/drivetn_perf PERF_REDIS_URL=redis://… pnpm --filter @drivetn/api perf
```

Options : `PERF_BOOKINGS`, `PERF_VEHICLES`, `PERF_CUSTOMERS`, `PERF_OTHER_AGENCIES`,
`PERF_OTHER_BOOKINGS`, `PERF_ITERATIONS`, `PERF_BUDGET_SECONDS`, `PERF_REUSE=1` (réutilise le jeu
inséré), `PERF_OUTPUT=fichier.json`.

Jeu mesuré : agence de 20 000 réservations, 200 véhicules, 5 000 clients, 42 000 encaissements,
4 200 avis, plus 10 agences de 2 000 réservations. PostgreSQL 16 en Docker sur un poste Windows.
« Avant » = chargement complet + calcul en mémoire ; « après » = `AgencyService` ; HTTP = endpoint
réel, guards compris.

| Endpoint                         | Avant p50 | Après p50 | Gain | HTTP p50 |  Réponse |
| -------------------------------- | --------: | --------: | ---: | -------: | -------: |
| dashboard                        |  3 282 ms |    137 ms |  ×24 |   139 ms |   111 Ko |
| nav-counts                       |  2 098 ms |     13 ms | ×166 |    18 ms |     6 Ko |
| bookings (page 1)                |  2 120 ms |     14 ms | ×157 |    19 ms |    26 Ko |
| bookings (recherche, filtre, p3) |  2 179 ms |     73 ms |  ×30 |    70 ms |    36 Ko |
| planning (31 jours)              |  2 108 ms |    133 ms |  ×16 |   160 ms | 1 591 Ko |
| vehicles                         |  2 358 ms |     39 ms |  ×60 |    40 ms |   145 Ko |
| customers (page 1)               |  3 282 ms |     38 ms |  ×88 |    42 ms |     5 Ko |
| customers/:id                    |  2 021 ms |     10 ms | ×204 |    15 ms |    10 Ko |
| payments (page 1)                |  2 310 ms |    108 ms |  ×21 |   112 ms |     5 Ko |
| reviews                          |  2 056 ms |    156 ms |  ×13 |   176 ms |   927 Ko |

Les valeurs absolues varient d'un poste et d'un passage à l'autre ; l'ordre de grandeur est stable.
`planning` et `reviews` sont limités par la taille de leur réponse (contrat non paginé ; traité
en Phase 2, étape B).

## Tests

- `test/agency-isolation.e2e-spec.ts` : agences A et B (client commun) et un gérant sans agence ;
  chaque lecture de A ne contient que ses données, chaque ressource de B répond 404 (détail,
  transition, encaissement, véhicule, statut, photos, client, réponse à un avis) sans être
  modifiée. Vérifié par mutation : retirer le filtre d'agence fait échouer la suite.
- `test/agency-lists.e2e-spec.ts` : limite par défaut, plafond à 100, valeurs invalides, pages
  hors bornes, parcours page par page de chaque tri, filtres et compteurs, recherche
  (référence, nom complet, plaque, téléphone, `%`/`_`/`\` littéraux), puis parité de chaque
  lecture avec l'ancien calcul en mémoire à quatre instants (milieu de mois, minuit à Tunis, le
  31, nouveau mois à Tunis).

Lancement : `E2E_DATABASE_URL=… E2E_REDIS_URL=… pnpm test` (ignorés sans ces variables).

## Différences connues avec l'ancien calcul

- Recherche multi-mots : chaque mot doit figurer dans un champ (sur-ensemble de l'ancien
  comportement).
- Accents et plaques sans espaces : corrigés en Phase 2, étape A (ci-dessous).
- `payments` n'a pas d'`agency_id` : les synthèses passent par une jointure sur `bookings`
  (piste : dénormaliser).
- En production, créer les index avec `CREATE INDEX CONCURRENTLY` : procédure dans
  [`docs/production-migrations.md`](docs/production-migrations.md) (Phase 2, étape C).

# Phase 2

## Étape A : recherche insensible aux accents et plaques sans espaces

Migration `20261008050000_accent_insensitive_search` :

- extensions `unaccent` et `pg_trgm` (« trusted » : installables par le propriétaire de la base) ;
- fonction `public.search_fold(text)` = `lower(public.unaccent('public.unaccent', $1))`, déclarée
  `IMMUTABLE` : `unaccent()` seul est `STABLE` (dictionnaire résolu via le `search_path`), ce qui
  l'exclut des index. Dictionnaire et schémas sont qualifiés : le résultat ne dépend pas du
  `search_path` (pg_restore compris). Elle ne touche ni `%`, ni `_`, ni `\` : `escapeLike` reste
  valable ;
- index GIN trigrammes : `users_name_search_idx` (prénom + nom), `users_contact_search_idx`
  (e-mail + ville), sur expressions, donc absents de `schema.prisma` et ignorés par
  `prisma migrate diff` ; `users_phone_search_idx` (téléphone), déclaré dans le schéma
  (`@@index([phone(ops: raw("gin_trgm_ops"))], type: Gin)`). `prisma migrate diff --exit-code` :
  aucune différence.

Requêtes (`agency.queries.ts`) :

- réservations : compteurs par statut et identifiants de la page en SQL paramétré, puis lecture
  Prisma des lignes de la page (`id IN (…) AND agency_id = …`). Chaque mot doit figurer dans la
  référence (`ILIKE`), OU chez un client (sous-requête sur `users` via les index trigrammes), OU
  sur un véhicule de l'agence (marque et modèle repliés, plaque comparée sans espaces ni tirets
  via `translate(plate_number, ' -', '')`). Les sous-requêtes sont évaluées une fois puis
  consultées par hachage (`hashed SubPlan`) ;
- clients : `search_fold(prénom + nom)`, `search_fold(e-mail + ville)` et téléphone, combinés
  par PostgreSQL en `BitmapOr` sur les trois index.

EXPLAIN ANALYZE (base de perf, 20 000 réservations dans l'agence, 10 000 utilisateurs) :
sous-requête clients via `users_name_search_idx` en 0,1 à 2 ms ; « Trabelsi », terminées,
page 3 : 6 ms ; compteurs : 9 à 35 ms ; clients « sfax » : 12 ms (`BitmapOr` sur les trois index).

| Endpoint (après, p50)                     | Phase 1 | Étape A |
| ----------------------------------------- | ------: | ------: |
| bookings (page 1)                         |   14 ms |   12 ms |
| bookings (recherche « Trabelsi », page 3) |   73 ms |   35 ms |
| bookings (plaque « 123TU1023 »)           |       — |   24 ms |
| customers (recherche « sfax »)            |       — |   33 ms |

Tests : `test/agency-search.e2e-spec.ts` (« hedi », « HÉDI », « chaabane », « citroen »,
« gabes », « medenine » ; « 123TU4567 », « 123-TU-4567 », « tu4567 » ; `%`, `_`, `\` littéraux ;
aucune donnée d'une autre agence) et `src/agency/agency.queries.spec.ts` (paramètres échappés).

## Étape B : planning borné et allégé, avis paginés

Aucune migration. Fichiers : `apps/api/src/agency/planning-window.ts` (nouveau),
`agency.{controller,service,mapper,queries}.ts`, `packages/types/src/agency-portal.ts`,
`apps/web/src/components/agency/{planning/planning-view,reviews/reviews-view}.tsx`,
`apps/web/src/lib/agency/{api,queries,types}.ts`.

### Changements de contrat

`GET /agency/planning`

| Point                        | Avant                                               | Après                                                                                                   |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `from`                       | obligatoire (`AAAA-MM-JJ`, non vérifiée)            | facultatif, défaut : la veille (jour de Tunis) ; date réelle exigée (`2026-02-30` → 400 `INVALID_DATE`) |
| `to` (nouveau, exclu)        | —                                                   | facultatif ; défaut `from` + `days`                                                                     |
| `days`                       | obligatoire, 1 à 62                                 | facultatif, défaut 14 ; `to` et `days` ensemble doivent concorder                                       |
| Fenêtre                      | `from` − 1 jour à `from` + `days` + 1 jour (UTC)    | exacte : `[minuit de Tunis de from, minuit de Tunis de to[`                                             |
| Réponse                      | `{ from, days, vehicles, bookings: BookingView[] }` | `{ from, to, days, vehicles, bookings: PlanningBooking[] }`                                             |
| Réservation                  | `BookingView` complète                              | `PlanningBooking` : `id, reference, vehicleId, status, pickupAt, returnAt, totalMillimes, customer`     |
| `customer` d'une réservation | `Customer` complet                                  | `{ id, firstName, lastName }`                                                                           |

Champs retirés des réservations du planning : `customerId`, lieux de départ et de retour, tarifs,
caution, note, `createdAt`, historique, `vehicle` (déjà présent dans `vehicles`), paiements,
synthèse de paiement, nombre de jours, et les coordonnées du client. Le front n'en utilisait
aucun (vérifié par le typecheck : `planning-view.tsx` est typé sur `PlanningBooking`) ; un clic
sur une réservation ouvre `/bookings/:id`, qui charge le détail complet via `useBooking` →
`getBooking()`.

Erreurs (400 `VALIDATION_ERROR`, `details: [{ path, message: code }]`) :

| Code                  | `path`         | Cas                        | Message                                                                                            |
| --------------------- | -------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `END_NOT_AFTER_START` | `to` ou `days` | `to <= from`, `days <= 0`  | La fin du planning doit être postérieure à son début (to > from).                                  |
| `WINDOW_TOO_LONG`     | `to` ou `days` | plus de 62 jours           | Le planning couvre au plus 62 jours.                                                               |
| `WINDOW_CONFLICT`     | `to`           | `to` ≠ `from` + `days`     | Indiquez la fin du planning par « to » ou par « days », pas les deux avec des valeurs différentes. |
| `INVALID_DATE`        | `from`, `to`   | format ou date inexistante | Données invalides.                                                                                 |
| `INVALID_DAYS`        | `days`         | non entier                 | Données invalides.                                                                                 |

Une réservation figure au planning si son statut est `PENDING`, `CONFIRMED`, `PICKED_UP`,
`RETURNED` ou `COMPLETED` (inchangé) et qu'elle chevauche la fenêtre : `pickupAt < fin` et `returnAt > début`. Une
réservation commencée avant la fenêtre et finie dedans y figure ; une réservation rendue
exactement à minuit de `from` (ou prise exactement à minuit de `to`) n'y figure pas.

`GET /agency/reviews`

| Point        | Avant                                                             | Après                                                                                |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Paramètres   | `filter`                                                          | `filter`, `page` (défaut 1), `limit` (défaut 20, max 100)                            |
| Réponse      | `{ items (tous), average, count, unansweredCount, distribution }` | `Paginated<Review>` (`items, total, page, pageSize, pageCount`) + mêmes statistiques |
| Statistiques | sur tous les avis visibles                                        | inchangé : sur tous les avis visibles, quels que soient le filtre et la page         |

`total` compte les avis du filtre (tous ou sans réponse) ; `count` et `unansweredCount` restent
les totaux de l'agence (onglets). Front : paramètre d'URL `page`, retour en page 1 au
changement d'onglet, `PaginationBar` sous la liste.

### Mesures

Même jeu et même poste que la Phase 1 (`PERF_ONLY='planning|reviews'`). « Phase 1 » = version
avant l'étape B (planning non borné côté contrat, réservations complètes, avis non paginés).

| Endpoint                             | Phase 1 p50 | Étape B p50 | HTTP p50 | Réponse Phase 1 | Réponse étape B |
| ------------------------------------ | ----------: | ----------: | -------: | --------------: | --------------: |
| planning (14 jours)                  |           — |       29 ms |    45 ms |               — |          212 Ko |
| planning (31 jours)                  |      133 ms |       39 ms |    55 ms |        1 591 Ko |          345 Ko |
| planning (62 jours)                  |           — |       47 ms |    78 ms |               — |          596 Ko |
| planning (défaut : veille, 14 jours) |           — |       26 ms |    34 ms |               — |          217 Ko |
| reviews (page 1)                     |      156 ms |       13 ms |    16 ms |          927 Ko |            5 Ko |
| reviews (sans réponse, page 3)       |           — |       14 ms |    20 ms |               — |            5 Ko |

La liste des 200 véhicules pèse environ 145 Ko dans chaque réponse du planning : les
réservations du planning 31 jours passent d'environ 1 450 Ko à environ 200 Ko. Le pire cas
autorisé (62 jours) reste sous 600 Ko et 100 ms au p95.

### Tests

- `test/agency-planning.e2e-spec.ts` (nouveau, horloge fixée) : une réservation par véhicule
  pour chaque cas (commence avant et finit dedans, dedans, finit après, couvre toute la fenêtre,
  rendue à minuit de `from`, prise à minuit de `to`, bornes à 23 h 30 UTC qui tombent dans la
  fenêtre de Tunis ou non, annulée, terminée) ; équivalence `to`/`days` ; défauts ; 62 jours
  acceptés, 63 refusés ; `days` à 0, négatif, énorme ; conflit ; dates mal formées ; jeu de clés
  allégé et détail via `GET /bookings/:id` ; aucune réservation d'une autre agence.
- `test/agency-isolation.e2e-spec.ts` : planning (`days`, `to`, défauts) ne contient que des
  véhicules, réservations et clients de A alors que B a des réservations dans la fenêtre ; avis
  pages 1, 2 et 3 (5 par page) distincts, sans avis de B ni avis masqué ; parcours complet égal
  aux avis visibles de A ; gérant sans agence : listes vides.
- `test/agency-lists.e2e-spec.ts` : parité avec l'oracle en mémoire (mis au nouveau contrat)
  pour le planning et pour chaque page des avis.
- `src/agency/planning-window.spec.ts` : bornes aux minuits de Tunis, défaut au passage de
  l'an à Tunis, refus et messages.

## Étape C : contraintes d'intégrité en base

### Détection préalable (lecture seule)

`apps/api/prisma/checks/integrity-constraints-detection.sql`, dans une transaction `READ ONLY`
annulée : prérequis (extensions, types de colonnes, index de l'étape A), lignes en infraction par
contrainte, paires de réservations actives qui se chevauchent, informations. Sur `drivetn_test`
et `drivetn_perf` (40 000 réservations) : **0 infraction, 0 chevauchement**, `btree_gist` 1.7
disponible. Cohérence des factures (`total = sous-total + TVA + timbre`) : 0 écart, mais 0
facture dans ces deux bases ; les seules écritures de montants (`invoicing.service.ts`, seed)
passent par `computeInvoiceAmounts`, cohérent par construction. Compatibilité des générateurs
vérifiée sans écrire en base : jeu de démo simulé à 2 503 instants (869 895 réservations), perf
(locations successives par véhicule), petites agences de test, seed admin.

### Contraintes (migration `20261008060000_integrity_constraints`)

| Table            | Contrainte                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `reviews`        | `rating` entre 1 et 5                                                                                     |
| `bookings`       | `return_at > pickup_at` ; tarif journalier `> 0` ; total et caution `>= 0`                                |
| `payments`       | montant `> 0` (le sens vient de `kind`)                                                                   |
| `vehicles`       | tarif journalier `> 0` ; caution et kilométrage `>= 0` ; limite km nulle ou `> 0` ; places `> 0`          |
| `invoices`       | montants `>= 0` ; TVA entre 0 et 10 000 pb ; échéance `>=` émission ; `total = sous-total + TVA + timbre` |
| `agencies`       | commission nulle ou entre 0 et 10 000 pb ; âge, permis, délai d'annulation `>= 0`                         |
| `vehicle_photos` | position `>= 0` ; largeur, hauteur, taille `> 0`                                                          |
| `otp_codes`      | tentatives `>= 0`                                                                                         |
| `bookings`       | `bookings_vehicle_no_overlap` : exclusion (voir ci-dessous)                                               |

```sql
EXCLUDE USING gist ("vehicle_id" WITH =, tsrange("pickup_at", "return_at", '[)') WITH &&)
WHERE ("status" IN ('PENDING', 'CONFIRMED', 'PICKED_UP'))
```

- Statuts actifs = `BLOCKING_BOOKING_STATUSES`, ceux du contrôle applicatif et de la recherche
  d'offres. `RETURNED`, `COMPLETED`, `CANCELLED`, `REJECTED`, `NO_SHOW`, `EXPIRED` libèrent le
  véhicule (une relocation après retour anticipé doit rester possible). Aucune transition ne
  ramène une réservation d'un statut inactif vers un statut actif.
- Bornes `[)` : même règle que l'application (`pickupAt < returnAt` et `returnAt > pickupAt`) ;
  un retour à 10 h et un départ à 10 h ne se chevauchent pas (testé).
- `tsrange` : colonnes `timestamp(3) without time zone` en UTC, indépendant du fuseau de session.
- CHECK évalués avant l'index d'exclusion : un retour avant le départ donne 23514, jamais
  l'erreur 22000 de `tsrange`.
- Les 19 CHECK sont ajoutés `NOT VALID`, puis validés par `20261008060100_validate_integrity_constraints`
  (fichier séparé, donc transaction séparée). `lock_timeout` de 10 s dans les deux.
- `prisma migrate diff --exit-code` : aucune différence (Prisma ignore CHECK et exclusions).

### Erreurs 23514 et 23P01

`apps/api/src/common/errors/constraint-violation.ts`, appelé par le filtre global : chaque
contrainte a son message en français, réponse 409 `{ code, message, details: { constraint } }`.

- `bookings_vehicle_no_overlap` → `VEHICLE_UNAVAILABLE`, « Ce véhicule n’est plus disponible sur
  ces dates. » (même réponse que le contrôle applicatif, conservé) ;
- CHECK → `CONFLICT` et un message propre (« La note d’un avis doit être comprise entre 1 et 5. »,
  « La date de retour doit être postérieure à la date de départ. »…) ;
- contrainte inconnue → 409 générique ; autre erreur → 500 inchangé.

Le SQLSTATE et le nom sont lus dans le seul message PostgreSQL (`PostgresError { code, message }`
du client Prisma, `meta` de P2010/P2004), pas dans le message complet de Prisma qui cite le code
source de l'appel. Le nom de contrainte ne dépend pas de la langue du serveur. Le détail
PostgreSQL (ligne en infraction, données personnelles) n'est ni renvoyé ni journalisé ; un
avertissement nomme la contrainte.

### Mesures (base de perf)

| Opération                              |        Durée | Verrou                                        |
| -------------------------------------- | -----------: | --------------------------------------------- |
| Contrainte d'exclusion (8 163 actives) | 368 à 379 ms | `ACCESS EXCLUSIVE` sur `bookings`             |
| Migration `20261008060000` complète    |     ~ 430 ms | 8 tables en `ACCESS EXCLUSIVE` jusqu'à la fin |
| 19 `VALIDATE CONSTRAINT`               |      ~ 30 ms | `SHARE UPDATE EXCLUSIVE` (n'arrête rien)      |
| 5 index de l'étape A en `CONCURRENTLY` |     ~ 200 ms | aucun blocage des écritures                   |

Jeu de perf régénéré avec les contraintes actives (40 000 réservations insérées en 21 s) ;
lectures inchangées : dashboard 137 ms, bookings page 1 13 ms, planning 31 jours 34 ms (p50).

### Tests

- `test/integrity-constraints.e2e-spec.ts` :
  - deux insertions simultanées qui contournent l'application (contrôle naïf sans verrou, les
    deux ne voient rien) : la base refuse la seconde (23P01 → 409) ; stable sur 5 passages ;
  - deux `POST /bookings` simultanés : une réponse 201, une 409 ;
  - chevauchement partiel (commence avant et finit pendant, commence pendant) refusé par l'API et
    par la base ; une demande `PENDING` bloque aussi ;
  - retour et départ au même instant acceptés (API et base) ;
  - annulation par le client qui libère le véhicule ; statuts terminés sans effet ;
  - notes 0 et 6 refusées, 1 à 5 acceptées ;
  - retour avant ou égal au départ refusé (409 en base, 400 par l'API) ;
  - montants négatifs refusés (réservation, véhicule, encaissement, facture), tarif journalier à
    0 refusé, total et caution à 0 acceptés, facture incohérente refusée.
- `src/common/errors/constraint-violation.spec.ts` : formes client et brute, serveur en français,
  extrait de code source ignoré, noms proches, contrainte inconnue, erreurs sans rapport, et
  chaque contrainte de la migration associée à un message.
- Retour arrière (`prisma/checks/integrity-constraints-rollback.sql`) testé sur une copie :
  20 contraintes supprimées, migrations retirées de l'historique, `migrate deploy` les rejoue.
- Procédure de production répétée sur une base dans l'état livré (4 migrations) : détection,
  `pg_dump -Fc` et restauration, index `CONCURRENTLY`, `migrate resolve`, `migrate deploy`,
  contrôles. Procédure : [`docs/production-migrations.md`](docs/production-migrations.md).

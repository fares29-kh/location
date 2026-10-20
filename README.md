# DriveTN

Plateforme SaaS multi-tenant de location de voitures pour le marché tunisien.

- **Aucun paiement en ligne** : le client réserve sans payer et règle directement l'agence. Les paiements et cautions sont uniquement **déclarés** par l'agence dans son portail.
- **Trois portails** servis par une seule application Next.js : client, agence et administration.
- **Montants en millimes** (entiers), dates stockées en UTC et affichées en `Africa/Tunis`.
- **Trois langues** : français (par défaut), arabe (RTL complet) et anglais.

> Le nom `DriveTN` est configurable via la variable `APP_NAME`.

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [URLs locales](#urls-locales)
- [Mode développement](#mode-développement)
- [Commandes utiles](#commandes-utiles)
- [Variables d'environnement](#variables-denvironnement)
- [Architecture](#architecture)
- [Langues et design system](#langues-et-design-system)
- [Qualité et tests](#qualité-et-tests)
- [Choix techniques notables](#choix-techniques-notables)
- [Production](#production)
- [Avancement](#avancement)

## Démarrage rapide

Prérequis : **Docker** avec **Compose v2** (Docker Desktop sous Windows/macOS). Rien d'autre n'est nécessaire.

```bash
cp .env.example .env        # PowerShell : Copy-Item .env.example .env
docker compose up --build
```

Au démarrage, l'API applique les migrations Prisma (`prisma migrate deploy`) puis exécute le seed idempotent. `minio-init` crée les buckets S3. Tous les services exposent un healthcheck : `docker compose ps` doit les afficher `healthy`.

Le seed crée les 24 gouvernorats et les lieux de prise en charge (villes, aéroports, gares et ports).

**Comptes de démo** : créés uniquement si `SEED_DEMO_ACCOUNTS=true` (valeur de `.env.example`, jamais en production). Mot de passe commun : `Demo2026!`. Le même drapeau (transmis au front sous `DEMO_ACCOUNTS_ENABLED`) les affiche sous le formulaire de connexion de chaque portail, avec un bouton qui remplit les identifiants.

| Compte             | Téléphone       | Rôle                  | Portail                 |
| ------------------ | --------------- | --------------------- | ----------------------- |
| `admin@demo.tn`    | `+216 20000001` | Super administrateur  | http://admin.localhost  |
| `agency@demo.tn`   | `+216 20000002` | Propriétaire d'agence | http://agency.localhost |
| `customer@demo.tn` | `+216 20000003` | Client                | http://localhost        |

**Mode local « comme en prod »** : la pile `docker compose up` utilise déjà les images de production. Pour en reproduire aussi la configuration, mettez dans `.env` `SEED_DEMO_ACCOUNTS=false`, `SWAGGER_ENABLED=false` et `DESIGN_PAGE_ENABLED=false`, puis renseignez `ADMIN_EMAIL`, `ADMIN_PHONE` et `ADMIN_PASSWORD` pour créer le super-administrateur initial (les comptes de démo déjà en base sont conservés). Seul le HTTPS diffère encore : laissez `COOKIE_SECURE=false` tant que la pile est servie en HTTP.

**Codes OTP en développement** : aucun SMS n'est envoyé (`MESSAGING_PROVIDER=console`). Les codes d'inscription, de connexion et de réinitialisation du mot de passe s'affichent dans les logs du worker :

```bash
docker compose logs -f worker
```

## URLs locales

| Service                                  | URL                                      |
| ---------------------------------------- | ---------------------------------------- |
| Portail client                           | http://localhost et http://app.localhost |
| Portail agence                           | http://agency.localhost                  |
| Portail admin                            | http://admin.localhost                   |
| API (santé)                              | http://localhost/api/v1/health           |
| Documentation OpenAPI                    | http://localhost/api/docs                |
| Mailpit (e-mails de dev)                 | http://mail.localhost                    |
| Console MinIO                            | http://minio.localhost                   |
| Endpoint S3                              | http://s3.localhost                      |
| Photos publiques (bucket public)         | http://localhost/media/…                 |
| Tableau de bord Traefik (dev uniquement) | http://traefik.localhost                 |

L'API est servie sous `/api` **sur chaque sous-domaine** (même origine), ce qui évite le CORS et simplifie les cookies httpOnly.

**Langues** : chaque portail est disponible en français sans préfixe (`/`), en arabe sous `/ar` et en anglais sous `/en` (ex. `http://agency.localhost/ar`). `/fr/...` redirige (308) vers l'URL sans préfixe.

**Page de démo du design system** : `/design` sur chaque portail (ex. `http://localhost/ar/design`), activée par `DESIGN_PAGE_ENABLED`.

**Résolution de `*.localhost`** : Chrome, Edge et Firefox résolvent automatiquement les sous-domaines de `localhost`. Pour d'autres outils (curl, certains navigateurs), ajoutez au fichier hosts (`C:\Windows\System32\drivers\etc\hosts` ou `/etc/hosts`) :

```
127.0.0.1 app.localhost agency.localhost admin.localhost mail.localhost minio.localhost s3.localhost traefik.localhost
```

Avec curl, vous pouvez aussi forcer l'en-tête : `curl -H "Host: agency.localhost" http://localhost/`.

**Port 80 déjà utilisé** (IIS, WSL, autre serveur web...) : définissez `HTTP_PORT=8088` dans `.env`, puis utilisez `http://agency.localhost:8088`, etc.

## Mode développement

Hot-reload de l'API, du worker et du front, sources montées en volume, PostgreSQL et Redis exposés sur `127.0.0.1` :

```bash
make dev
# sans make :
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --renew-anon-volumes
```

`--renew-anon-volumes` recrée les volumes `node_modules` des conteneurs quand les dépendances changent. Sous Windows et macOS, la détection des changements utilise le polling (les événements fichiers ne traversent pas les montages).

Développement hors Docker (Node 20.17+ ou 22, pnpm 9) :

```bash
pnpm install
pnpm codegen                          # build de @drivetn/types + client Prisma
pnpm --filter @drivetn/api dev        # nécessite PostgreSQL et Redis (DATABASE_URL, REDIS_URL)
pnpm --filter @drivetn/web dev
```

## Commandes utiles

| `make`           | Équivalent sans make                             | Rôle                                       |
| ---------------- | ------------------------------------------------ | ------------------------------------------ |
| `make up`        | `docker compose up --build -d`                   | Démarre toute la pile en arrière-plan      |
| `make dev`       | voir ci-dessus                                   | Pile de développement avec hot-reload      |
| `make down`      | `docker compose down --remove-orphans`           | Arrête la pile (données conservées)        |
| `make logs`      | `docker compose logs -f --tail=200`              | Logs de tous les services                  |
| `make ps`        | `docker compose ps`                              | État et santé des services                 |
| `make seed`      | `docker compose exec api node dist/seed/seed.js` | Rejoue le seed (idempotent)                |
| `make reset`     | `docker compose down --volumes` puis `make up`   | **Efface toutes les données** et redémarre |
| `make test`      | `pnpm codegen && pnpm test`                      | Tests unitaires et d'intégration           |
| `make lint`      | `pnpm lint && pnpm format:check`                 | ESLint et Prettier                         |
| `make typecheck` | `pnpm typecheck`                                 | Vérification TypeScript                    |
| `make check`     | `pnpm check`                                     | Tout ce que lance la CI                    |

`make help` liste toutes les cibles.

## Variables d'environnement

Toutes les variables sont documentées dans [`.env.example`](.env.example). Les principales :

| Variable                                         | Rôle                                                                                       | Défaut                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| `APP_NAME`                                       | Nom affiché de la plateforme                                                               | `DriveTN`                            |
| `APP_DOMAIN`                                     | Domaine racine des portails                                                                | `localhost`                          |
| `APP_TIMEZONE`                                   | Fuseau d'affichage                                                                         | `Africa/Tunis`                       |
| `HTTP_PORT`                                      | Port HTTP publié par Traefik                                                               | `80`                                 |
| `POSTGRES_PASSWORD`                              | Mot de passe PostgreSQL                                                                    | **obligatoire**                      |
| `REDIS_PASSWORD`                                 | Mot de passe Redis                                                                         | **obligatoire**                      |
| `MINIO_ROOT_PASSWORD`                            | Mot de passe MinIO (8 caractères minimum)                                                  | **obligatoire**                      |
| `S3_BUCKET_PUBLIC` / `S3_BUCKET_PRIVATE`         | Buckets photos (servi sous `/media`) / documents d'identité                                | `drivetn-public` / `drivetn-private` |
| `SWAGGER_ENABLED`                                | Active `/api/docs`                                                                         | `true`                               |
| `CORS_ORIGINS`                                   | Origines CORS autorisées (vide = même origine)                                             | vide                                 |
| `SEED_ON_START`                                  | Exécute le seed au démarrage de l'API                                                      | `true`                               |
| `SEED_DEMO_ACCOUNTS`                             | Crée les comptes de démo (jamais en prod) et les affiche sous les formulaires de connexion | `false` (`true` dans `.env.example`) |
| `ADMIN_EMAIL` / `ADMIN_PHONE` / `ADMIN_PASSWORD` | Super-administrateur initial, créé au démarrage s'il n'existe pas (jamais modifié ensuite) | vide (rien n'est créé)               |
| `JWT_ACCESS_SECRET`                              | Signature des access tokens (32 car. min.)                                                 | **obligatoire**                      |
| `OTP_HASH_SECRET`                                | Clé HMAC des codes OTP stockés (32 car. min.)                                              | **obligatoire**                      |
| `ACCESS_TOKEN_TTL_SECONDS`                       | Durée de vie de l'access token                                                             | `900`                                |
| `REFRESH_TOKEN_TTL_DAYS`                         | Durée de vie du refresh token rotatif                                                      | `30`                                 |
| `COOKIE_SECURE`                                  | Cookies `Secure` (à activer en HTTPS)                                                      | `false`                              |
| `MESSAGING_PROVIDER`                             | Envoi des SMS/WhatsApp (`console` en dev)                                                  | `console`                            |
| `DESIGN_PAGE_ENABLED`                            | Active la page `/design` (`false` en prod)                                                 | `false` (`true` dans `.env.example`) |

L'API et le front valident leur configuration avec Zod au démarrage et refusent de démarrer si une variable est invalide.

## Architecture

```
apps/
  api/        NestJS : API REST /api/v1, Swagger, Prisma, Redis, worker BullMQ
  web/        Next.js 15 (App Router) : les 3 portails, sélectionnés par nom d'hôte
packages/
  types/      Schémas Zod et types partagés front/back (langues, téléphone, montants, statuts)
  ui/         Composants React accessibles (Radix + Tailwind), clair/sombre et RTL
  config/     tsconfig, ESLint (flat config), Prettier, preset Tailwind
docker/       Dockerfiles multi-stage, configuration Traefik, init MinIO
```

```mermaid
flowchart LR
  browser[Navigateur] --> traefik["Traefik :80"]
  traefik -->|"localhost, app/agency/admin.localhost"| web[web Next.js]
  traefik -->|"PathPrefix /api"| api[api NestJS]
  traefik -->|mail.localhost| mailpit[Mailpit]
  traefik -->|"minio/s3.localhost"| minio[MinIO]
  web -->|"API_INTERNAL_URL"| api
  api --> postgres[(PostgreSQL 16)]
  api --> redis[(Redis 7)]
  worker[worker BullMQ] --> redis
```

- **Sélection du portail et de la langue** : le middleware Next.js lit l'en-tête `Host` et le préfixe de langue, puis réécrit la requête vers le segment interne (`/client/fr`, `/agency/ar`, `/admin/en`...). Un portail n'est donc pas accessible depuis le sous-domaine d'un autre.
- **API** : préfixe `/api`, versionnement par URI (`/api/v1/...`), erreurs normalisées `{ code, message, details }`, Helmet, `trust proxy` pour Traefik.
- **Santé** : `GET /api/v1/health` vérifie PostgreSQL, Redis et le battement du worker. Le statut vaut `ok`, `degraded` (worker arrêté) ou `error` (HTTP 503, dépendance critique indisponible).
- **Worker** : même image que l'API, point d'entrée `dist/worker.js`. Il exécute les files BullMQ `maintenance` (job planifié de battement) et `messaging` (envoi des codes OTP par SMS ou WhatsApp). Les rappels et expirations arriveront dans les phases suivantes.
- **Lieux** : `GET /api/v1/locations/governorates` et `GET /api/v1/locations` (filtres par gouvernorat et type), publics et mis en cache dans Redis.
- **Images** : multi-stage, finales en `node:20-alpine`, utilisateur non-root `node`. L'image API ne contient que `dist/`, le schéma Prisma et les dépendances de production (`pnpm deploy --prod`).
- **Données** : volumes nommés `pgdata`, `redisdata` et `miniodata`.

### Authentification et rôles

- **Comptes** : identifiant téléphone `+216` (obligatoire, vérifié par OTP à l'inscription) ou e-mail, mot de passe haché en Argon2id. Les clients s'inscrivent sur le portail client, les propriétaires d'agence sur le portail agence. Les comptes admin ne sont créés que par le seed.
- **Rôles** : `CUSTOMER` (portail client), `AGENCY_OWNER` et `AGENCY_STAFF` (portail agence), `ADMIN` avec un sous-rôle (`SUPER_ADMIN`, `SUPPORT`, `FINANCE`) pour le portail admin. Les routes API sont protégées par `@Roles(...)`. Côté front, les pages agence et admin exigent un utilisateur du bon portail, et `/account` exige un client.
- **Sessions** : access token JWT (15 min) et refresh token opaque rotatif (30 jours, haché en base, détection de réutilisation), dans les cookies httpOnly `drivetn_at` et `drivetn_rt`, `SameSite=Lax`, propres à chaque sous-domaine. Le middleware Next.js et le client API renouvellent la session automatiquement.
- **Changement de portail** : un client qui se connecte sur le portail agence (ou l'inverse) est redirigé vers son portail avec un code d'échange à usage unique (60 s), échangé sur `/auth/handoff` contre une session.
- **OTP** : 6 chiffres par SMS ou WhatsApp, valables 5 minutes, 5 essais maximum, renvoi après 60 s. Ils servent à l'inscription, à la connexion sans mot de passe et à la réinitialisation du mot de passe. Les codes sont stockés hachés (HMAC).
- **Protection** : limitation de débit Redis par route, par IP, par téléphone et par identifiant, vérification de l'en-tête `Origin` sur les requêtes qui modifient des données, journal d'audit des connexions, inscriptions et changements de mot de passe.
- **Endpoints** : `/api/v1/auth/*` (`signup`, `otp/request`, `otp/verify`, `login`, `login/otp`, `password/forgot`, `password/reset`, `handoff`, `refresh`, `logout`, `me`), `PATCH /api/v1/users/me` et `POST /api/v1/users/me/password`. Détails dans `/api/docs`.

## Langues et design system

- **i18n** : `next-intl`, messages dans [`apps/web/messages`](apps/web/messages) (`fr.json` fait référence). Les clés sont typées : une clé manquante en arabe ou en anglais fait échouer `typecheck`, et un test vérifie clés et paramètres `{...}`.
- **RTL** : `<html lang="ar" dir="rtl">`, propriétés CSS logiques (`ms-*`, `start-*`...), icônes directionnelles inversées, police IBM Plex Sans Arabic. Les chiffres restent latins dans les trois langues.
- **Montants** : `85,000 DT` en français, `85.000 د.ت` en arabe (composant `Money`, 3 décimales).
- **Thèmes** : clair, sombre ou système (`next-themes`). Chaque portail a sa couleur : client bleu `#2563EB`, agence émeraude `#059669`, admin violet `#7C3AED`, via l'attribut `data-portal` et des variables CSS HSL du preset Tailwind.
- **Composants** (`@drivetn/ui`) : boutons, champs (téléphone `+216`, code OTP), sélecteurs, cartes, badges de statut réservation/paiement, alertes, états vide/erreur/chargement, fenêtres, panneaux, menus, onglets, stepper, pagination, tableaux, sidebar, topbar, bouton WhatsApp (`wa.me`).

## Qualité et tests

```bash
pnpm check     # codegen + lint + format + typecheck + tests
```

- TypeScript strict partout (`noUncheckedIndexedAccess`, aucun `any`), ESLint `strictTypeChecked`, `no-console` interdit.
- ESLint `jsx-a11y` et `react-hooks` sur le front et `@drivetn/ui`.
- Tests avec **Vitest** : schémas partagés (téléphone, montants, langues, auth), configuration, filtre d'erreurs, santé, OTP, gardes de rôles et d'origine, gabarits de messages, seed, résolution des portails et des langues, routes protégées et refresh dans le middleware, cohérence des traductions, composants UI (Testing Library).
- **Tests e2e de l'authentification** ([`apps/api/test/auth.e2e-spec.ts`](apps/api/test/auth.e2e-spec.ts)) : inscription avec OTP, connexions, refresh, changement de portail, rôles, réinitialisation du mot de passe, contre un vrai PostgreSQL et un vrai Redis. Ils sont ignorés si `E2E_DATABASE_URL` et `E2E_REDIS_URL` ne sont pas définies. La base doit être dédiée aux tests (elle est vidée avant chaque test) et migrée :

  ```bash
  DATABASE_URL=postgresql://test:test@localhost:5432/drivetn_test pnpm --filter @drivetn/api prisma:deploy
  E2E_DATABASE_URL=postgresql://test:test@localhost:5432/drivetn_test E2E_REDIS_URL=redis://localhost:6379/15 pnpm --filter @drivetn/api test
  ```

- **Contraintes d'intégrité en base** : bornes (notes de 1 à 5, retour après départ, montants, facture cohérente) et exclusion des réservations actives qui se chevauchent sur un véhicule. Une violation (SQLSTATE 23514 ou 23P01) répond 409 avec un message en français, jamais 500 ([`constraint-violation.ts`](apps/api/src/common/errors/constraint-violation.ts)). Mise en production des migrations (sauvegarde, index `CONCURRENTLY`, `migrate resolve`, `migrate deploy`, retour arrière) : [`docs/production-migrations.md`](docs/production-migrations.md).
- **Husky** : `lint-staged` avant chaque commit, **Commitlint** (Conventional Commits, ex. `feat(api): ...`) sur le message.
- **CI GitHub Actions** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) : lint, format, typecheck, tests (dont les tests e2e avec des services PostgreSQL et Redis), puis build des images Docker et smoke test de la pile complète (santé, gouvernorats, pages de connexion des trois portails, connexion du client de démo).

## Choix techniques notables

- **Image MinIO** : MinIO ne publie plus d'images sur Docker Hub ni sur Quay. La pile utilise par défaut `cgr.dev/chainguard/minio` (MinIO compilé depuis les sources, maintenu par Chainguard). Elle est remplaçable via `MINIO_IMAGE`.
- **Pas de Turborepo** : les scripts `pnpm -r` / `--filter` suffisent à cette échelle.
- **`@drivetn/types` compilé en CommonJS** : il est consommé tel quel par NestJS (CommonJS) et par Next.js. Lancez `pnpm codegen` après avoir modifié ce paquet ou le schéma Prisma.
- **`@swc/core` figé en 1.15.x** (utilisé uniquement par Vitest côté API) : la 1.16 échoue au chargement de son binaire natif sur certains postes Windows.
- **`next build` / `next dev` hors Docker sous Windows** : le plugin `next-intl` charge `@swc/core` 1.16, qui copie son binaire natif dans `%LOCALAPPDATA%\swc`. Si les droits NTFS de ce dossier sont incorrects, le chargement échoue (« Failed to load native binding »). Utilisez Docker (`make dev`), ou corrigez les droits de `%LOCALAPPDATA%\swc` (propriétaire et contrôle total pour votre compte). Linux, macOS et la CI ne sont pas concernés.
- **Pas de middleware `next-intl`** : un seul middleware résout portail et langue, puis transmet la langue au rendu serveur via l'en-tête interne `x-drivetn-locale`.
- **Polices auto-hébergées** via `next/font` (aucune requête vers Google côté navigateur).
- **`@node-rs/argon2` plutôt que `argon2`** : le paquet `argon2` n'a pas de binaire chargeable sur `node:20-alpine` et tente une compilation `node-gyp` sans Python. `@node-rs/argon2` fournit des binaires précompilés (dont musl).
- **Refresh token opaque plutôt que JWT** : il est stocké haché en base, ce qui permet la rotation, la révocation d'une famille de sessions en cas de réutilisation et la déconnexion de tous les appareils.
- **Paramètres plateforme** : le modèle `PlatformSetting` stocke la TVA (19 %), le timbre fiscal (1 DT) et la commission par défaut. Les taux sont en points de base, les montants en millimes.

## Production

`docker compose up` est la pile locale : PostgreSQL, Redis et MinIO sur la machine. Le déploiement pour les agences est un VPS Hetzner, les photos sur Object Storage et la base recopiée en continu hors du serveur. Mode d'emploi, budget et remontée après panne : [`deploy/README.md`](deploy/README.md).

## Avancement

| Phase  | Contenu                                                                          | État     |
| ------ | -------------------------------------------------------------------------------- | -------- |
| 1      | Fondations : monorepo, Docker Compose, CI, page Hello, `/api/v1/health`          | Terminée |
| 2      | Design system, thèmes clair/sombre, RTL, layouts des 3 portails                  | Terminée |
| 3      | Authentification, OTP, rôles, seed (gouvernorats, aéroports, comptes de démo)    | Terminée |
| 4 à 10 | Flotte, recherche, réservation, opérations agence, admin, finitions, déploiement | À venir  |

Déploiement VPS : [`deploy/README.md`](deploy/README.md).

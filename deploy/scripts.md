# Les scripts

Tous les scripts de production se lancent depuis `/opt/drivetn`, en root :

```bash
cd /opt/drivetn
bash deploy/scripts/<nom>.sh
```

`lib.sh` n'est pas une commande. Les autres scripts le chargent pour lire `.env` et appeler Docker Compose avec les deux fichiers de production (`docker-compose.prod.yml` et `docker-compose.monitoring.yml`).

## Ordre, première installation Azure

1. `install-server.sh` prépare Ubuntu.
2. `init-env.sh azure` crée `.env`. Vous y mettez le domaine, l'e-mail Let's Encrypt, les deux clés Azure et le compte administrateur.
3. `init-buckets.sh` crée les conteneurs Blob.
4. `up.sh --build` construit les images et démarre le site.
5. `backup.sh` fait la première sauvegarde complète. Sans elle, les journaux seuls ne restaurent rien.

La suite du premier jour (disque, DNS, certificat) est dans [azure.md](azure.md).

## Ce qui tourne tout seul

`install-server.sh` et `up.sh` écrivent `/etc/cron.d/drivetn`. Les heures sont en UTC.

| Heure                     | Script             | Rôle                                                             |
| ------------------------- | ------------------ | ---------------------------------------------------------------- |
| 02:15 chaque nuit         | `backup.sh`        | Sauvegarde complète de la base et copie chiffrée de `.env`       |
| minute 20 de chaque heure | `check-archive.sh` | Vérifie que les journaux partent encore vers Azure               |
| toutes les 5 minutes      | `write-metrics.sh` | Met à jour les carrés Grafana (sauvegarde, journaux, PostgreSQL) |

Le journal de ces trois scripts est `/var/log/drivetn-backup.log`.

## Ordre si la machine est neuve

Le disque de données est encore là : `install-server.sh`, poser le `.env` sauvegardé, `restore-images.sh`, puis `up.sh`. Ne pas formater le disque.

Le disque est perdu : même début, puis `restore-postgres.sh LATEST` **avant** `up.sh`. `up.sh` lancé avant la restauration créerait une base vide.

---

## `install-server.sh`

Prépare un Ubuntu 24.04 vide. À lancer une fois, en root, après le `git clone`.

1. Installe les paquets : certificats, curl, git, pare-feu, restic, cron, openssl.
2. Installe Docker s'il manque, et le démarre.
3. Crée un fichier d'échange de 2 Go si la machine n'en a pas.
4. Crée `/var/lib/drivetn/postgres`, `redis` et `metrics`.
5. Ouvre le pare-feu pour les ports 22, 80 et 443 seulement.
6. Installe les trois tâches planifiées et la rotation du journal.

Si `/var/lib/drivetn` n'est pas un disque à part, le script le dit. La base est alors sur le disque du système.

## `init-env.sh`

Crée le fichier `.env` à la racine. Il refuse de toucher un `.env` qui existe déjà.

```bash
bash deploy/scripts/init-env.sh azure
```

Sans argument, le modèle est celui de Hetzner.

1. Tire au sort les mots de passe (base, Redis, jetons, restic, Grafana).
2. Recopie le modèle `deploy/.env.azure.example` ou `deploy/.env.example` en remplaçant les marqueurs `__`.
3. Pose les droits `600` : seul root lit le fichier.

Ensuite vous ouvrez `.env` et vous remplissez le domaine, l'e-mail, les clés des deux comptes de stockage et le compte administrateur. Copiez `RESTIC_PASSWORD` dans un gestionnaire de mots de passe : sans lui, la copie de `.env` est illisible.

## `init-buckets.sh`

Crée les espaces de stockage nommés dans `.env`. Relançable : un conteneur déjà là n'est pas recréé.

Sur Azure, il appelle `init-azure-containers.sh`. Sur Hetzner, il crée trois buckets S3 et ouvre la lecture publique sur le bucket des photos.

## `init-azure-containers.sh`

Appelé par `init-buckets.sh`. Vous n'avez pas à le lancer à part.

1. `drivetn-public` sur le compte photos, lecture anonyme.
2. `drivetn-private` sur le compte photos, accès fermé.
3. `drivetn-backups` sur le compte de sauvegarde, accès fermé.

Si le conteneur public échoue, activez « Autoriser l'accès anonyme aux objets blob » sur le compte photos, puis relancez `init-buckets.sh`.

## `up.sh`

Démarre toute la pile. C'est la commande habituelle après un `git pull`.

```bash
bash deploy/scripts/up.sh
bash deploy/scripts/up.sh --build
```

`--build` reconstruit PostgreSQL, l'API et le site. Sans `--build`, la reconstruction n'a lieu que si une de ces trois images manque.

1. Refuse de démarrer si le domaine est vide ou `localhost`, si les comptes de démo sont activés, si les cookies ne sont pas en HTTPS, si l'e-mail Let's Encrypt manque, ou si les clés de stockage manquent.
2. Refuse un mot de passe Grafana de moins de 16 caractères, ou qui contient `$`.
3. Construit les images une par une, pour ne pas saturer les 8 Go de mémoire.
4. Réécrit les tâches planifiées.
5. Écrit les contrôles HTTPS de Grafana : les quatre adresses du domaine, jointes à Traefik sur le réseau Docker.
6. Démarre les conteneurs et affiche leur état.

Le site s'arrête le temps du redémarrage des conteneurs. Les données du disque ne sont pas effacées.

## `status.sh`

Affiche l'état, sans rien modifier.

1. Liste les conteneurs.
2. Affiche la date de la dernière sauvegarde complète, ou dit qu'il n'y en a pas.
3. Affiche le dernier envoi de journaux, le dernier échec et le nombre total d'échecs.
4. Rappelle l'adresse du tableau Grafana.
5. Liste les sauvegardes de base présentes sur Azure.

Le nombre d'échecs ne revient pas à zéro. Ce qui compte est la date : le dernier envoi réussi doit être plus récent que le dernier échec.

## `backup.sh`

Sauvegarde complète. La nuit à 02:15 UTC, et une fois à la main le jour de l'installation.

1. Prend un verrou pour ne pas tourner en même temps qu'une autre sauvegarde. Il attend jusqu'à une heure.
2. Envoie une copie complète de la base avec `wal-g`.
3. Ne garde que les 7 copies complètes les plus récentes.
4. Copie `.env` chiffré avec restic (14 jours, 8 semaines, 6 mois). Le paquet restic d'Ubuntu ne sait pas parler à Azure : le script installe le binaire officiel s'il le faut.
5. Revérifie que les journaux partent.
6. Écrit la date dans `/var/lib/drivetn/last-backup-ok`, puis met à jour Grafana.

Les photos ne sont pas dans cette sauvegarde. Elles sont déjà dans le compte de stockage des photos.

## `check-archive.sh`

Dit si le dernier envoi de journaux PostgreSQL a réussi. Chaque heure, et à la fin de `backup.sh`.

1. Affiche la date du dernier succès, la date du dernier échec et le nombre d'échecs.
2. S'arrête avec un message d'erreur si le dernier événement est un échec, ou s'il n'y a jamais eu de succès.

S'il est lancé pendant une sauvegarde, il sort sans rien faire. `backup.sh` le rappelle avec `--locked`, le verrou étant déjà pris.

## `write-metrics.sh`

Écrit trois chiffres lus par Grafana, dans `/var/lib/drivetn/metrics/drivetn.prom`. Toutes les 5 minutes, et juste après une sauvegarde réussie.

1. L'heure de la dernière sauvegarde complète. `0` s'il n'y en a pas encore.
2. `1` si PostgreSQL répond.
3. `1` si le dernier envoi de journaux a réussi.

Le carré **Journaux base** lit le troisième chiffre. La page Grafana ne bouge pas toute seule : rechargez-la.

## `verify-backup.sh`

Relit la dernière sauvegarde complète dans un dossier temporaire, puis l'efface. La base en service n'est pas modifiée. Utile pour vérifier qu'Azure a vraiment le fichier, avant d'en avoir besoin.

1. Télécharge la sauvegarde `LATEST`.
2. Vérifie que le fichier `PG_VERSION` est dedans.
3. Supprime le dossier temporaire.

## `save-images.sh`

Envoie les trois images déjà construites (API, site, PostgreSQL) dans le compte de sauvegarde. À lancer après un `--build`, pour pouvoir remonter une machine neuve sans recompiler.

1. Refuse s'il reste moins de 4 Go libres dans `/tmp`.
2. Exporte et compresse les images, puis calcule leurs empreintes.
3. Envoie `api.tar.gz`, `web.tar.gz`, `postgres.tar.gz` et `SHA256SUMS` dans `images/`.

## `restore-images.sh`

À lancer sur une machine neuve, avant `up.sh`. Télécharge les images enregistrées par `save-images.sh` et les charge dans Docker. Vérifie les empreintes avant de les charger.

## `restore-postgres.sh`

Remplace la base par une sauvegarde. À n'utiliser que si le disque de données est perdu. Si le disque est intact, `up.sh` suffit.

```bash
bash deploy/scripts/restore-postgres.sh LATEST
```

1. Demande de retaper le domaine. Une autre réponse annule tout.
2. Arrête l'API, le worker, le site, puis PostgreSQL.
3. Décale l'ancien dossier de données vers un nom daté. Il n'est pas supprimé.
4. Télécharge la sauvegarde demandée.
5. Relance PostgreSQL, qui rejoue les journaux.
6. Vide Redis, puis relance le reste du site.

Les codes encore en file d'attente au moment de la panne ne partent pas. La base restaurée est la référence.

## `hetzner-floating-ip.sh`

Uniquement pour un serveur Hetzner. Ajoute l'IPv4 flottante sur la carte réseau et la conserve au redémarrage. Inutile sur Azure.

```bash
bash deploy/scripts/hetzner-floating-ip.sh 203.0.113.10
```

## `render-k8s-env.sh`

Écrit `k8s.env` pour un futur passage sur Kubernetes. Le fichier est ignoré par git. Il ne contient ni le mot de passe restic ni le préfixe des journaux : ils restent sur la machine. Pas utilisé sur la VM actuelle.

## Scripts qui ne se lancent pas à la main

| Fichier                         | Quand il tourne                      | Ce qu'il fait                                                                                                       |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `deploy/scripts/lib.sh`         | Chargé par les autres                | Lit `.env`, choisit Azure ou Hetzner, fournit `compose`, `s3` et `az_backup`                                        |
| `deploy/postgres/entrypoint.sh` | Au démarrage du conteneur PostgreSQL | Exige un préfixe de journaux, active l'archivage vers Azure toutes les 60 secondes, puis lance PostgreSQL           |
| `apps/api/docker-entrypoint.sh` | Au démarrage de l'API                | Applique les migrations Prisma, crée les données de base si `SEED_ON_START` est vrai, puis lance l'API ou le worker |
| `docker/minio/init.sh`          | Pile locale seulement                | Crée les deux buckets MinIO du développement. Jamais en production                                                  |

# Déployer DriveTN

Pile de production pour quelques agences : un VPS, Docker Compose, les photos hors du serveur, et une copie continue de la base dans une autre ville. Le jour où le trafic le justifie, les mêmes conteneurs passent sur Kubernetes sans changer le code.

Le fichier `docker-compose.yml` à la racine reste la pile locale (MinIO, HTTP, Mailpit). Sur le serveur, on utilise `docker-compose.prod.yml`.

Avec des crédits Azure, suivez [azure.md](azure.md). Hetzner reste possible ensuite : même Compose, autre fichier `.env`.

## Fournisseur

**Hetzner Cloud, zone `eu-central`.** Pas OVH, pour ce pilote.

Un CX33 (4 vCPU, 8 Go, 80 Go) coûte 8,49 € HT par mois hors IPv4, d'après la grille Hetzner appliquée le 15 juin 2026. L'IPv4 principale est en supplément (environ 0,50 €), l'IPv4 flottante coûte 3 €, un volume de 10 Go environ 0,50 €. L'Object Storage a un forfait qui inclut 1 To de stockage et 1 To de trafic sortant (environ 6,49 €, à confirmer sur [hetzner.com/storage/object-storage](https://www.hetzner.com/storage/object-storage)). Total visé : **environ 19 € HT par mois**.

OVH est un peu plus proche de la Tunisie (Gravelines plutôt que Nuremberg, quelques dizaines de millisecondes). À machine égale, le VPS y est plus cher, et le Kubernetes managé ne sert à rien tant qu'un seul serveur suffit. Les conteneurs n'ont aucune dépendance à Hetzner : le jour d'une migration, seuls le endpoint S3 et l'adresse de la base changent.

Prix hors TVA. Revérifiez la grille au moment de commander.

## Ce qui survit à la perte du VPS

| Donnée                                    | Où elle vit                                                                                | Si le VPS disparaît                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Réservations, comptes, paiements déclarés | PostgreSQL sur un volume réseau, et journaux WAL copiés à Helsinki au plus toutes les 60 s | Volume sain : rien de commité n'est perdu. Volume perdu : au plus une minute de transactions commitées  |
| Photos et documents                       | Object Storage à Falkenstein, pas sur le VPS                                               | Toujours là                                                                                             |
| Fichier `.env` (secrets)                  | Gestionnaire de mots de passe, et copie chiffrée à Helsinki                                | À reprendre depuis le gestionnaire                                                                      |
| Images Docker                             | Copie dans le bucket de sauvegarde après chaque déploiement                                | On les recharge, on ne recompile pas                                                                    |
| Certificat HTTPS                          | Recréé par Let's Encrypt                                                                   | Quelques minutes                                                                                        |
| File Redis (SMS en attente, cache)        | Disque du volume, volontairement jetable                                                   | Les codes OTP déjà en base restent. Un SMS pas encore parti ne part pas ; l'utilisateur en redemande un |

Ce n'est pas de la réplication synchrone. Deux serveurs en miroir coûteraient le double pour gagner les dernières secondes. Le volume couvre la panne de la machine. Les WAL à Helsinki couvrent la perte du volume ou de Nuremberg.

Quelqu'un qui obtient root sur le VPS peut aussi effacer le bucket de sauvegarde : la clé S3 est sur la machine, c'est le prix d'un seul serveur. Le gestionnaire de mots de passe ne protège pas contre ça. Ça protège contre une panne, une suppression, un datacenter injoignable.

## Schéma

```
Navigateur (Tunisie)
        │  HTTPS
        ▼
IPv4 flottante ── CX33 à Nuremberg (nbg1)
                    traefik, web, api, worker
                    PostgreSQL sur le volume 10 Go
                    Redis (cache et files, jetable)
                    │
        photos, documents              WAL, .env chiffré, images Docker
                    │                              │
                    ▼                              ▼
        Object Storage Falkenstein (fsn1)   Object Storage Helsinki (hel1)
```

Les trois sites sont dans la zone réseau `eu-central`. Le trafic entre le serveur et l'Object Storage n'est pas facturé. L'IPv4 flottante se réassigne à un serveur de Falkenstein, Nuremberg ou Helsinki : le DNS ne change pas.

## 1. Créer les ressources

Dans un projet Hetzner Cloud :

1. **Volume** de 10 Go, emplacement **Nuremberg (`nbg1`)**. Ne le formatez pas depuis la console si elle propose de l'attacher plus tard : on le fait à la main, une seule fois.
2. **Serveur CX33**, image Ubuntu 24.04, emplacement **Nuremberg**, même zone que le volume. Clé SSH uniquement, pas de mot de passe. Attachez le volume.
3. **IPv4 flottante** dans la zone `eu-central`. Assignez-la au serveur. Notez l'adresse.
4. **Object Storage** : activez le produit et créez une clé d'accès S3. Les buckets eux-mêmes sont créés par `init-buckets.sh`, pas à la main.
5. Pare-feu Cloud facultatif : entrant TCP 22, 80 et 443. Le script d'installation active aussi `ufw`.

Repérez l'identifiant du volume (`scsi-0HC_Volume_...` dans la console, ou `ls /dev/disk/by-id/` une fois connecté).

## 2. DNS

Chez le registrar, quatre enregistrements **A** vers l'IPv4 **flottante** (pas l'IPv4 principale du serveur) :

| Nom      | Exemple si le domaine est `drivetn.tn` |
| -------- | -------------------------------------- |
| apex     | `drivetn.tn`                           |
| `app`    | `app.drivetn.tn`                       |
| `agency` | `agency.drivetn.tn`                    |
| `admin`  | `admin.drivetn.tn`                     |

`drivetn.tn` et `app.drivetn.tn` servent le portail client. TTL 300 secondes pendant la mise en route. Le DNS doit répondre avant le premier démarrage, sinon Let's Encrypt échoue (Traefik réessaie).

## 3. Préparer le serveur

Connectez-vous en root.

```bash
# Une seule fois. Remplacez l'identifiant par celui du volume.
mkfs.ext4 /dev/disk/by-id/scsi-0HC_Volume_XXXX
mkdir -p /var/lib/drivetn
echo '/dev/disk/by-id/scsi-0HC_Volume_XXXX /var/lib/drivetn ext4 discard,nofail 0 2' >> /etc/fstab
mount /var/lib/drivetn

apt-get update && apt-get install -y git
git clone <url-du-depot> /opt/drivetn
cd /opt/drivetn
bash deploy/scripts/install-server.sh
bash deploy/scripts/hetzner-floating-ip.sh 203.0.113.10
```

`mkfs` efface le volume. On ne le relance jamais. `install-server.sh` installe Docker, un swap de 2 Go (la compilation Next.js sature 8 Go sans lui), le pare-feu et le cron.

Si le SSH coupe après l'IPv4 flottante, ouvrez la console du serveur dans Hetzner et supprimez `/etc/netplan/60-drivetn-floating-ip.yaml`, puis `netplan apply`.

Vérifiez que le volume est bien monté : `findmnt /var/lib/drivetn`.

## 4. Secrets et buckets

```bash
cd /opt/drivetn
bash deploy/scripts/init-env.sh
```

Le script affiche un `.env` aux droits `600`. **Copiez-le tout de suite dans un gestionnaire de mots de passe**, en particulier `RESTIC_PASSWORD`. Sans ce mot de passe, la copie chiffrée du `.env` est illisible. Le serveur ne doit pas en être le seul exemplaire.

Éditez ensuite `/opt/drivetn/.env` :

- `APP_DOMAIN` : le domaine apex, sans `https://`
- `ACME_EMAIL` : une boîte lue, pour les avis Let's Encrypt
- `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY` : la clé créée à l'étape 1
- `ADMIN_EMAIL`, `ADMIN_PHONE` (8 chiffres tunisiens), `ADMIN_PASSWORD` (lettres et chiffres, 8 caractères minimum)

Les noms de buckets et les mots de passe générés se laissent tels quels. Pas d'espace dans les valeurs (ou mettez la valeur entre guillemets). Pas de `$` non plus : Compose le consomme en lisant le fichier.

```bash
bash deploy/scripts/init-buckets.sh
```

Trois buckets : photos et documents à Falkenstein, sauvegardes à Helsinki. Le bucket public reçoit une politique de lecture. S'il la refuse, passez ce bucket en visibilité **Public** dans la console. Le bucket privé et le bucket de sauvegarde restent privés.

Les photos sont servies en `https://<bucket-public>.fsn1.your-objectstorage.com/...`. L'API continue d'écrire avec le SDK S3 (`forcePathStyle`), déjà prévu pour un endpoint qui n'est pas celui d'Amazon.

## 5. Démarrer

```bash
cd /opt/drivetn
bash deploy/scripts/up.sh --build
```

La première compilation est longue (API, puis front, l'un après l'autre pour ne pas épuiser la mémoire). `docker compose ps` doit finir avec des services `healthy`. Le worker n'a pas de healthcheck HTTP : la santé de l'API passe à `ok` quand il bat.

```bash
bash deploy/scripts/backup.sh
bash deploy/scripts/verify-backup.sh
bash deploy/scripts/save-images.sh
bash deploy/scripts/status.sh
```

`verify-backup.sh` retélécharge la sauvegarde dans un dossier temporaire et ne touche pas à la base en service. `save-images.sh` envoie les images Docker à Helsinki (1 à 2 Go, une fois par déploiement, pas chaque nuit).

Ouvrez `https://agency.<domaine>`. Le HTTP redirige vers le HTTPS. Le certificat couvre l'apex, `app`, `agency` et `admin`.

**Codes OTP.** `MESSAGING_PROVIDER=console` est le seul fournisseur branché aujourd'hui : aucun SMS n'est envoyé. Les codes sont dans les logs du worker :

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

Les agences de test doivent le savoir. Brancher un vrai SMS sera un changement de code, pas d'hébergement.

Le cron installé lance `backup.sh` chaque nuit à 02:15 UTC et `check-archive.sh` toutes les heures. `HEALTHCHECKS_URL` dans `.env` (compte gratuit [healthchecks.io](https://healthchecks.io/)) prévient si la nuit a échoué. Sans ça, regardez `/var/log/drivetn-backup.log` et `bash deploy/scripts/status.sh`.

## Mettre à jour

```bash
cd /opt/drivetn
bash deploy/scripts/backup.sh
git pull
bash deploy/scripts/up.sh --build
bash deploy/scripts/save-images.sh
```

La sauvegarde d'avant la mise à jour est le point de retour. Les migrations partent au démarrage de l'API (`prisma migrate deploy`). La procédure des index `CONCURRENTLY` reste dans [docs/production-migrations.md](../docs/production-migrations.md) : sur le VPS, les commandes `docker compose` prennent `-f docker-compose.prod.yml`.

Arrêter sans effacer les données : `docker compose -f docker-compose.prod.yml down`. Ne lancez pas `down -v` : le volume nommé de Traefik part, le certificat aussi (Let's Encrypt le refera). Les données Postgres sont un bind mount, `down` ne les supprime pas. `down -v` ne les supprime pas non plus, mais ce n'est pas une raison de le lancer.

## La machine est morte

Deux cas. On les distingue dans la console Hetzner : le volume `nbg1` est-il encore `available` ?

Gardez sous la main, hors du serveur : le `.env`, le mot de passe restic, la clé S3, et l'accès au compte Hetzner.

### A. Le volume est sain

C'est le cas si le serveur est supprimé ou bloqué mais que Nuremberg répond. **Ne lancez pas `restore-postgres.sh`.** La base sur le volume est plus récente que la sauvegarde.

1. Créez un CX33 **à Nuremberg** (un volume ne se monte pas dans une autre ville). Ubuntu 24.04, clé SSH.
2. Détachez le volume de l'ancien serveur s'il y est encore, attachez-le au nouveau. Ne le formatez pas.
3. Montez-le :

   ```bash
   mkdir -p /var/lib/drivetn
   mount /dev/disk/by-id/scsi-0HC_Volume_XXXX /var/lib/drivetn
   echo '/dev/disk/by-id/scsi-0HC_Volume_XXXX /var/lib/drivetn ext4 discard,nofail 0 2' >> /etc/fstab
   ```

4. Réassignez l'IPv4 flottante au nouveau serveur (console Hetzner). Le DNS ne change pas.
5. Clonez le dépôt dans `/opt/drivetn` à la même révision que le déploiement, ou `git clone` puis `git checkout` du commit connu.
6. Remettez le `.env` (gestionnaire de mots de passe, ou restic — plus bas). `chmod 600 .env`.
7. `bash deploy/scripts/install-server.sh`
8. `bash deploy/scripts/hetzner-floating-ip.sh <ipv4 flottante>`
9. `bash deploy/scripts/restore-images.sh` puis `bash deploy/scripts/up.sh`

   Si les images n'ont jamais été envoyées : `bash deploy/scripts/up.sh --build` (comptez une demi-heure à trois quarts d'heure).

10. `bash deploy/scripts/status.sh` puis un essai de connexion sur les trois portails.

`install-server.sh` voit le volume déjà monté et ne le formate pas. Les répertoires `postgres` et `redis` existent déjà ; le `mkdir` ne les vide pas.

### B. Le volume est perdu, ou Nuremberg est injoignable

La base repart de la sauvegarde. Perte maximale : environ une minute de transactions commitées. Les photos à Falkenstein restent en place.

1. Créez un CX33 dans **eu-central** (Falkenstein ou Helsinki si Nuremberg est down). Ubuntu 24.04.
2. Créez un **nouveau** volume de 10 Go **dans la même ville que ce serveur**, formatez-le et montez-le sur `/var/lib/drivetn` comme à l'étape 3 de l'installation.
3. Réassignez l'IPv4 flottante. Elle peut suivre le serveur dans toute la zone `eu-central`.
4. Installez Docker : clone, `install-server.sh`, script d'IPv4 flottante.
5. Récupérez le `.env`. Depuis une machine qui a `restic` et les variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `RESTIC_PASSWORD`, `RESTIC_REPOSITORY` :

   ```bash
   restic -o s3.bucket-lookup=path restore latest --target /tmp/drivetn-env
   ```

   Le fichier est dans `/tmp/drivetn-env/opt/drivetn/.env` (restic conserve le chemin). Posez-le dans `/opt/drivetn/.env`.

6. `bash deploy/scripts/restore-images.sh`
7. Restaurez la base **avant** tout `up.sh`. Un PostgreSQL vide démarré avec le même préfixe WAL écrirait dans les sauvegardes de production.

   ```bash
   bash deploy/scripts/restore-postgres.sh LATEST
   ```

   Le script demande de retaper le domaine. Il télécharge la sauvegarde, rejoue les journaux, vide Redis, puis démarre le site. S'il y avait déjà un répertoire de données, il le conserve sous `/var/lib/drivetn/postgres.avant-<date>`.

8. `bash deploy/scripts/status.sh` et un parcours des trois portails.

Pour revenir à une sauvegarde précise : `bash deploy/scripts/status.sh` liste les noms (`base_...`), puis `bash deploy/scripts/restore-postgres.sh base_...`.

Si `restore-postgres.sh` échoue au téléchargement, il s'arrête et dit où est l'ancienne copie. Il ne relance pas le site sur une base à moitié écrite.

## Tester avant d'inviter une agence

Une fois, pas le jour de la panne :

1. `bash deploy/scripts/backup.sh` puis `bash deploy/scripts/verify-backup.sh` doivent finir sans erreur.
2. `bash deploy/scripts/status.sh` : `last_archived_time` est récent, `last_failed_time` est vide ou plus ancien.
3. Sur un second CX33 que vous supprimerez ensuite, faites le cas B jusqu'au login admin. Vous validez la procédure, pas seulement les scripts.
4. Effacez ce second serveur **et son volume de test**. Ne détachez pas le volume de production.

## Kubernetes, quand un VPS ne suffit plus

Rien dans l'application n'est collé à Compose. Le passage se fait service par service.

| Aujourd'hui                     | Sur le cluster                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `api`, `worker`, `web`          | Les manifestes `deploy/k8s/`                                                                                                       |
| Traefik et ses labels Docker    | Un Ingress. Le fichier vise nginx ; avec Traefik (k3s), retirez l'annotation `proxy-body-size`                                     |
| PostgreSQL dans Compose + WAL-G | CloudNativePG, ou une base managée. On coupe les écritures, `pg_dump -Fc`, restauration, puis on change l'hôte dans `DATABASE_URL` |
| Redis                           | Un petit Redis dans le cluster. Il peut démarrer vide                                                                              |
| Object Storage                  | Inchangé. Les URLs des photos restent valides                                                                                      |
| Cron `backup.sh`                | Un CronJob, ou les sauvegardes de l'opérateur PostgreSQL                                                                           |
| `docker.sock` de Traefik        | Disparaît. C'est le seul accès privilégié de la pile                                                                               |

Les manifestes lancent **une** réplique de l'API, stratégie `Recreate`, parce que les migrations Prisma tournent encore au démarrage du processus. On ne monte pas à deux répliques avant d'avoir sorti `prisma migrate deploy` dans un Job.

```bash
# Au moment de la bascule, pas avant.
bash deploy/scripts/render-k8s-env.sh
# Éditez k8s.env : hôtes postgres et redis du cluster.
kubectl create namespace drivetn
kubectl -n drivetn create secret generic drivetn-env --from-env-file=k8s.env
# Remplacez example.tn dans deploy/k8s/ingress.yaml, poussez les images
# drivetn-api:local et drivetn-web:local vers un registre, puis :
kubectl apply -k deploy/k8s
```

`k8s.env` est gitignoré. Il contient les secrets applicatifs, pas le mot de passe restic.

Ordre de bascule : restaurer la base, pointer le Secret, appliquer les manifestes, déplacer l'IPv4 flottante (ou le DNS) vers le load balancer, éteindre le Compose. Les photos ne bougent pas.

## Limites connues

- Les OTP ne sortent pas du serveur tant que `MESSAGING_PROVIDER=console`.
- Redis perdu = un SMS en attente perdu, pas une réservation.
- La clé S3 unique peut lire les photos et écrire les sauvegardes. Séparer les clés demanderait deux projets Object Storage ; le forfait est par compte, mais la console ne limite pas une clé à un bucket. Le bucket de sauvegarde est dans une autre ville, il n'est pas verrouillé contre un root malveillant.
- Le premier déploiement compile sur le VPS. Les suivants aussi, sauf si `save-images.sh` a été lancé : la remontée recharge alors les images.
- MinIO du `docker-compose.yml` local ne sert pas en production. Ne copiez pas son volume vers le VPS.

## Dépannage

| Signe                                                   | Piste                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| L'API ne démarre pas, variable manquante                | `docker compose -f docker-compose.prod.yml logs api`                                                                    |
| Certificat qui ne vient pas                             | DNS pas encore sur l'IP flottante, ou port 80 fermé. `docker compose -f docker-compose.prod.yml logs traefik`           |
| Photos cassées                                          | Bucket public vraiment public, et `MEDIA_PUBLIC_URL` égal à `https://<bucket>.fsn1.your-objectstorage.com`              |
| `last_failed_time` plus récent que `last_archived_time` | Clé S3, bucket Helsinki, ou horloge. Tant que ça dure, `pg_wal` grossit sur le volume                                   |
| `wal-push` répond 400 à propos d'un checksum            | Noter le message exact avant de changer l'image : certains SDK S3 envoient des en-têtes qu'Hetzner refuse               |
| Plus de place                                           | `docker system prune` n'efface pas les volumes nommés ni `/var/lib/drivetn`. Les logs Docker sont plafonnés à 10 Mo × 3 |

Pour un essai de certificat sans toucher au quota Let's Encrypt de production, ajoutez dans `.env` :

```bash
ACME_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory
```

Le navigateur n'acceptera pas ce certificat. Retirez la variable et supprimez le volume `traefik_certs` avant l'ouverture aux agences (`docker compose -f docker-compose.prod.yml down`, puis `docker volume rm drivetn-prod_traefik_certs`).

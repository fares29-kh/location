# Déployer DriveTN sur Azure

Même pile que sur Hetzner : une machine, Docker Compose, les photos hors du disque, les journaux de la base dans une autre région. Ici les crédits Azure paient la machine et le stockage Blob.

Le serveur est en **France Central** (Paris, le plus proche de la Tunisie). Les sauvegardes sont en **West Europe**. Un disque de données séparé porte PostgreSQL : s'il est encore là, on le branche sur une machine neuve et rien de commité n'est perdu. S'il a disparu, la restauration perd au plus une minute de transactions.

Poussez d'abord le dépôt (cette version, avec `DEPLOY_TARGET=azure`) vers Git. Le serveur le clone.

## 1. Groupe de ressources

Portail Azure, **Groupes de ressources**, créer `drivetn`, région **France Central**.

Tout se crée dans ce groupe. Un compte de stockage peut être dans une autre région que son groupe.

## 2. Machine virtuelle

- Image : **Ubuntu Server 24.04 LTS**
- Taille : **Standard_B2ms** (2 vCPU, 8 Go). Une B2s à 4 Go sature à la compilation.
- Région : **France Central**. Ne choisissez pas de zone de disponibilité : le disque de données doit pouvoir se rebrancher sur une autre machine de la région.
- Authentification : clé SSH. L'utilisateur sera `azureuser`.
- Disque du système : 64 Go suffisent.
- **Disque de données** : créer et attacher un disque **SSD standard de 32 Go**. Notez son nom.
- Réseau : IP publique **statique**. Ports entrants : SSH 22. Après la création, dans le groupe de sécurité réseau, ajoutez **80** et **443**.

Notez l'adresse IP publique statique.

## 3. DNS

Quatre enregistrements **A** vers cette IP statique :

| Nom      | Exemple             |
| -------- | ------------------- |
| apex     | `drivetn.tn`        |
| `app`    | `app.drivetn.tn`    |
| `agency` | `agency.drivetn.tn` |
| `admin`  | `admin.drivetn.tn`  |

Le DNS doit répondre avant le premier démarrage.

## 4. Préparer la machine

```bash
ssh azureuser@<ip-statique>
sudo -i
```

Le disque de données est `/dev/disk/azure/scsi1/lun0`. Vérifiez avec `ls -l /dev/disk/azure/scsi1/` avant de formater. Ce n'est pas le disque du système.

```bash
mkfs.ext4 /dev/disk/azure/scsi1/lun0
mkdir -p /var/lib/drivetn
echo '/dev/disk/azure/scsi1/lun0 /var/lib/drivetn ext4 defaults,nofail 0 2' >> /etc/fstab
mount /var/lib/drivetn
findmnt /var/lib/drivetn

apt-get update && apt-get install -y git
git clone <url-du-depot> /opt/drivetn
cd /opt/drivetn
bash deploy/scripts/install-server.sh
```

`mkfs` efface le disque. On ne le relance jamais. `install-server.sh` installe Docker, un swap de 2 Go, le pare-feu et la sauvegarde de nuit.

## 5. Secrets, comptes de stockage, conteneurs

```bash
cd /opt/drivetn
bash deploy/scripts/init-env.sh azure
grep AZURE_ /opt/drivetn/.env
```

Le script choisit deux noms uniques, du type `drivetnmedia1a2b3c` et `drivetnbackup1a2b3c`. Créez **ces** comptes dans le portail, dans le groupe `drivetn` :

| Compte                 | Région         | Accès anonyme aux blobs |
| ---------------------- | -------------- | ----------------------- |
| `AZURE_MEDIA_ACCOUNT`  | France Central | Activé                  |
| `AZURE_BACKUP_ACCOUNT` | West Europe    | Désactivé               |

Standard, redondance LRS. Copiez la clé d'accès de chacun (Clés d'accès, key1).

Copiez aussi tout le `.env` dans un gestionnaire de mots de passe, surtout `RESTIC_PASSWORD`.

Éditez `/opt/drivetn/.env` :

- `APP_DOMAIN` : le domaine, sans `https://`
- `ACME_EMAIL`
- `AZURE_MEDIA_KEY="..."` et `AZURE_BACKUP_KEY="..."` : une clé par compte, entre guillemets doubles
- `ADMIN_EMAIL`, `ADMIN_PHONE` (8 chiffres), `ADMIN_PASSWORD`

Pas de `$` dans les valeurs que vous tapez vous-même.

```bash
bash deploy/scripts/init-buckets.sh
```

Trois conteneurs : `drivetn-public` (lecture anonyme), `drivetn-private`, et `drivetn-backups` en West Europe.

## 6. Démarrer

```bash
cd /opt/drivetn
bash deploy/scripts/up.sh --build
bash deploy/scripts/backup.sh
bash deploy/scripts/verify-backup.sh
bash deploy/scripts/save-images.sh
bash deploy/scripts/status.sh
```

La première compilation est longue. Puis ouvrez `https://agency.<domaine>`.

Les codes OTP ne partent pas par SMS. Ils sont dans :

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

La base est recopiée vers West Europe chaque nuit à 02:15 UTC, et ses journaux partent au plus toutes les 60 secondes.

## Si la machine tombe

**Le disque de données est encore là.** Arrêtez l'ancienne machine si elle existe. Créez une B2ms Ubuntu 24.04 en France Central, sans zone. Détachez le disque de données et attachez-le à la nouvelle. Dans le portail, détachez l'IP publique statique de l'ancienne carte réseau et attachez-la à la nouvelle : le DNS ne change pas. Ne formatez pas le disque.

```bash
sudo -i
mkdir -p /var/lib/drivetn
mount /dev/disk/azure/scsi1/lun0 /var/lib/drivetn
echo '/dev/disk/azure/scsi1/lun0 /var/lib/drivetn ext4 defaults,nofail 0 2' >> /etc/fstab
git clone <url-du-depot> /opt/drivetn
# remettez le .env (gestionnaire de mots de passe), chmod 600
cd /opt/drivetn
bash deploy/scripts/install-server.sh
bash deploy/scripts/restore-images.sh
bash deploy/scripts/up.sh
```

Ne lancez pas `restore-postgres.sh` : le disque est plus récent que la sauvegarde.

**Le disque est perdu.** Nouvelle machine, nouveau disque de 32 Go, même montage que l'étape 4, même IP statique déplacée. Restaurez le `.env`, puis :

```bash
bash deploy/scripts/install-server.sh
bash deploy/scripts/restore-images.sh
bash deploy/scripts/restore-postgres.sh LATEST
```

Pas de `up.sh` avant `restore-postgres.sh` : un PostgreSQL vide écrirait dans les sauvegardes. Le script demande de retaper le domaine, rejoue les journaux, vide Redis et démarre le site. Les photos en France Central restent en place.

Pour sortir le `.env` du Blob si le gestionnaire de mots de passe n'est pas sous la main, sur une machine qui a restic :

```bash
export AZURE_ACCOUNT_NAME=<compte backup>
export AZURE_ACCOUNT_KEY=<clé backup>
export RESTIC_REPOSITORY=azure:drivetn-backups:/restic
export RESTIC_PASSWORD=<mot de passe restic>
restic restore latest --target /tmp/drivetn-env
```

Le fichier est sous `/tmp/drivetn-env/opt/drivetn/.env`.

# Premier setup et relance de DriveTN sur Azure

Une machine Ubuntu, Docker Compose, les photos hors du disque, la base recopiée dans une autre région. Les crédits Azure paient la machine et le stockage Blob.

Le dépôt à cloner est `https://github.com/fares29-kh/location.git`. Sur le serveur on utilise `docker-compose.prod.yml`. Le fichier `docker-compose.yml` à la racine reste la pile locale (MinIO, HTTP).

Installation en service :

| Élément              | Valeur                                                 |
| -------------------- | ------------------------------------------------------ |
| Groupe de ressources | `drivetn`, France Central                              |
| Machine              | `Standard_B2ms`, Ubuntu 24.04, utilisateur `azureuser` |
| IP publique statique | `20.199.16.4`                                          |
| Domaine              | `madrasti.dev`                                         |
| Photos               | compte `drivetnmedia29ba25`, France Central            |
| Sauvegardes          | compte `drivetnbackup29ba25`, Germany West Central     |
| Disque de données    | 32 Go, monté sur `/var/lib/drivetn`                    |
| Code                 | `/opt/drivetn`                                         |

## Ce qui survit à la perte de la machine

| Donnée                           | Où elle vit                                                                  | Si la machine disparaît                                                           |
| -------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Réservations, comptes, paiements | PostgreSQL sur le disque de 32 Go, journaux copiés au plus toutes les 60 s   | Disque encore là : rien de commité n'est perdu. Disque perdu : au plus une minute |
| Photos et documents              | Blob `drivetnmedia29ba25`                                                    | Toujours là                                                                       |
| Fichier `.env`                   | Gestionnaire de mots de passe, et copie chiffrée sur le compte de sauvegarde | À reprendre depuis le gestionnaire                                                |
| Images Docker                    | Copie sur le compte de sauvegarde après `save-images.sh`                     | On les recharge, on ne recompile pas                                              |
| Certificat HTTPS                 | Recréé par Let's Encrypt au démarrage de Traefik                             | Quelques minutes                                                                  |
| Redis                            | Disque de données, jetable                                                   | Un SMS pas encore parti ne part pas. Les codes OTP déjà en base restent           |

La sauvegarde de nuit part à 02:15 UTC. Elle n'existe qu'après le premier `backup.sh` de l'étape 9.

## 1. Groupe de ressources

Portail Azure, **Groupes de ressources**, créer `drivetn`, région **France Central**.

Un compte de stockage peut être dans une autre région que son groupe.

## 2. Machine virtuelle

- Image : **Ubuntu Server 24.04 LTS**
- Taille : **Standard_B2ms** (2 vCPU, 8 Go). Une machine à 4 Go sature à la compilation.
- Région : **France Central**. Pas de zone de disponibilité : le disque de données doit pouvoir se rebrancher sur une autre machine de la région.
- Authentification : clé SSH. L'utilisateur est `azureuser`. Il n'a pas de mot de passe root : tout se fait avec `sudo`.
- Disque du système : 64 Go suffisent.
- **Disque de données** : SSD standard de **32 Go**, créé et attaché à la machine.
- Réseau : IP publique **statique**. Ports entrants : 22, puis 80 et 443 dans le groupe de sécurité réseau.

Notez l'adresse IP. Ici : `20.199.16.4`.

## 3. DNS

Chez le registrar (Name.com : **My Domains**, le domaine, **Manage DNS Records**), quatre enregistrements **A** vers l'IP statique. Type **A**, TTL **300**.

| Host     | Exemple               | Answer        |
| -------- | --------------------- | ------------- |
| vide     | `madrasti.dev`        | `20.199.16.4` |
| `app`    | `app.madrasti.dev`    | `20.199.16.4` |
| `agency` | `agency.madrasti.dev` | `20.199.16.4` |
| `admin`  | `admin.madrasti.dev`  | `20.199.16.4` |

S'il existe déjà une ligne A de parking, modifiez son Answer au lieu d'en ajouter une seconde. Le DNS doit répondre avant le premier démarrage HTTPS.

## 4. Disque, code, Docker

```bash
ssh azureuser@20.199.16.4
sudo -i
lsblk
```

Le disque du système est celui monté sur `/` (souvent `sda`, environ 30 Go). Le disque temporaire Azure est monté sur `/mnt` (souvent `sdb`) : on ne le formate jamais. Le disque de données de 32 Go apparaît comme `sdc`, et son chemin stable est `/dev/disk/azure/scsi1/lun0`. On ne formate que celui-là, et une seule fois.

```bash
mkfs.ext4 /dev/disk/azure/scsi1/lun0
mkdir -p /var/lib/drivetn
echo '/dev/disk/azure/scsi1/lun0 /var/lib/drivetn ext4 defaults,nofail 0 2' >> /etc/fstab
systemctl daemon-reload
mount /var/lib/drivetn
findmnt /var/lib/drivetn

apt-get update && apt-get install -y git
git clone https://github.com/fares29-kh/location.git /opt/drivetn
cd /opt/drivetn
bash deploy/scripts/install-server.sh
```

`findmnt` doit montrer `/var/lib/drivetn` sur le disque de 32 Go. `install-server.sh` installe Docker, un swap de 2 Go, le pare-feu (22, 80, 443) et la sauvegarde de nuit.

## 5. Noms des comptes de stockage

Les noms sont choisis sur le serveur, avant le portail. Ils sont uniques dans tout Azure.

```bash
cd /opt/drivetn
bash deploy/scripts/init-env.sh azure
grep AZURE_ /opt/drivetn/.env
```

Créez **ces** deux comptes dans le groupe `drivetn`. Performance **Standard**, redondance **LRS**. **Déployer sur une zone étendue Azure** : Non. **Service principal** : **Objets blob Azure**. Laissez l'espace de noms hiérarchique désactivé.

| Compte                           | Région         | Accès anonyme |
| -------------------------------- | -------------- | ------------- |
| valeur de `AZURE_MEDIA_ACCOUNT`  | France Central | Activé        |
| valeur de `AZURE_BACKUP_ACCOUNT` | West Europe    | Désactivé     |

Sur cette installation : `drivetnmedia29ba25` et `drivetnbackup29ba25`. West Europe a refusé les nouveaux comptes : le compte de sauvegarde est en **Germany West Central**. Sweden Central ou Poland Central conviennent aussi. Le compte photos reste en France Central.

L'accès anonyme n'est pas sur le premier écran. Onglet **Avancé**, case **Autoriser l'accès anonyme aux objets blob** : cochée pour les photos, décochée pour les sauvegardes. Si le compte existe déjà : **Paramètres**, **Configuration**, le même interrupteur, **Enregistrer**.

Pour chaque compte : **Clés d'accès**, **key1**.

## 6. Remplir le fichier d'environnement

Copiez tout `/opt/drivetn/.env` dans un gestionnaire de mots de passe, surtout `RESTIC_PASSWORD`.

```bash
nano /opt/drivetn/.env
```

À renseigner :

- `APP_DOMAIN` : le domaine seul, ici `madrasti.dev`. Pas de `https://`, pas de `agency.`
- `ACME_EMAIL` : une boîte lue, pour les avis Let's Encrypt
- `AZURE_MEDIA_KEY="clé du compte photos"`
- `AZURE_BACKUP_KEY="clé du compte de sauvegarde"`
- `ADMIN_EMAIL`, `ADMIN_PHONE` (8 chiffres), `ADMIN_PASSWORD`

Les clés restent entre guillemets doubles. Aucune valeur tapée à la main ne contient `$`. Enregistrez avec `Ctrl+O`, puis `Ctrl+X`.

## 7. Conteneurs Blob

```bash
cd /opt/drivetn
bash deploy/scripts/init-buckets.sh
```

Le script crée `drivetn-public` (lecture anonyme), `drivetn-private`, et `drivetn-backups`. La commande se termine par `Conteneurs prêts.` Si le conteneur public échoue, activez l'accès anonyme sur le compte photos et relancez la même commande.

## 8. Démarrer

```bash
cd /opt/drivetn
bash deploy/scripts/up.sh --build
```

La première compilation dure plusieurs minutes. Ensuite `https://agency.madrasti.dev` répond. Le certificat est demandé à Let's Encrypt pour `madrasti.dev`, `app`, `agency` et `admin`, puis renouvelé tout seul. Le HTTP est redirigé vers le HTTPS.

Les codes de connexion ne partent pas par SMS. Ils s'affichent ici :

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

Le compte administrateur est celui de `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

## 9. Première sauvegarde

À lancer une fois le site démarré, avant de considérer la machine remplaçable :

```bash
cd /opt/drivetn
bash deploy/scripts/backup.sh
bash deploy/scripts/verify-backup.sh
bash deploy/scripts/save-images.sh
bash deploy/scripts/status.sh
```

`backup.sh` envoie une base PostgreSQL et une copie chiffrée du `.env`. `save-images.sh` garde les images Docker pour éviter une recompilation le jour d'une panne. La même sauvegarde de base repart chaque nuit à 02:15 UTC. Les journaux de la base partent au plus toutes les 60 secondes.

## 10. Tableau de bord

Le suivi démarre avec la pile. Il montre la charge de la machine, l'état de chaque conteneur, PostgreSQL, Redis, l'âge de la dernière sauvegarde et si les journaux de la base partent encore.

Sur une installation déjà créée, ajoutez dans `/opt/drivetn/.env` un mot de passe d'au moins 16 caractères, sans `$` :

```bash
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<mot de passe>
```

Puis :

```bash
cd /opt/drivetn
bash deploy/scripts/up.sh
```

Ouvrez `https://admin.<domaine>/monitoring`. Ici : `https://admin.madrasti.dev/monitoring`. L'identifiant est `admin`, le mot de passe est `GRAFANA_ADMIN_PASSWORD`.

Prometheus et les collecteurs ne sont pas exposés sur Internet. Seul Grafana l'est, en HTTPS, sur le sous-domaine `admin`. Les mesures de sauvegarde sont réécrites toutes les cinq minutes, et juste après chaque `backup.sh`.

Les alertes sont évaluées par Prometheus. Le tableau DriveTN production affiche en bas le nombre d'alertes en cours. Le tableau DriveTN services détaille chaque service. Un e-mail part vers `SMTP_USER` (le Gmail du `.env`) quand une alerte commence, et un autre quand elle se termine. Le même message est renvoyé au plus toutes les 4 heures tant que la panne dure. Le détail est aussi dans Grafana, menu Alerting. Une alerte ne part que si la condition dure assez longtemps pour écarter un à-coup : 2 minutes pour une base arrêtée, 10 à 15 minutes pour un disque ou une mémoire saturés, 26 heures pour une sauvegarde manquée.

Deux niveaux : `critical` coupe le service ou les données (disque, base, Redis, site, sauvegarde, journaux). `warning` se dégrade sans tout couper (mémoire, processeur, worker, file d'attente, certificat, redémarrages). Tant que la VM est arrêtée, elle ne peut pas s'alerter elle-même : ces règles couvrent les pannes des services, pas la disparition de la machine.

La première sauvegarde absente déclenche une alerte au bout de 6 heures. Lancez `bash deploy/scripts/backup.sh` le jour de l'installation pour l'éteindre. Le contrôle HTTPS interroge Traefik depuis le réseau Docker. Tant que le certificat est encore celui par défaut de Traefik, les quatre adresses restent en alerte.

## Arrêter et relancer sans changer de machine

Arrêter les conteneurs en gardant les données :

```bash
cd /opt/drivetn
docker compose -f docker-compose.prod.yml down
```

Relancer, sans recompiler :

```bash
cd /opt/drivetn
bash deploy/scripts/up.sh
```

Après un redémarrage de la VM, Docker relance les conteneurs si `/var/lib/drivetn` est monté. Vérifiez avec `findmnt /var/lib/drivetn`, puis `bash deploy/scripts/status.sh`.

`down -v` efface le volume du certificat. Let's Encrypt le refera, mais ce n'est pas une commande de routine. Le `mkfs` de l'étape 4 ne se relance jamais sur un disque qui contient déjà la base.

## Relancer sur une machine neuve

Deux cas. Dans les deux, la nouvelle machine est une B2ms Ubuntu 24.04 en France Central, sans zone de disponibilité. Dans le portail, détachez l'IP `20.199.16.4` de l'ancienne carte réseau et attachez-la à la nouvelle : les enregistrements DNS ne changent pas. Arrêtez l'ancienne machine si elle répond encore.

### Le disque de 32 Go est encore là

Détachez-le de l'ancienne machine et attachez-le à la nouvelle. Ne le formatez pas.

```bash
sudo -i
mkdir -p /var/lib/drivetn
mount /dev/disk/azure/scsi1/lun0 /var/lib/drivetn
grep -q '/var/lib/drivetn' /etc/fstab || echo '/dev/disk/azure/scsi1/lun0 /var/lib/drivetn ext4 defaults,nofail 0 2' >> /etc/fstab
systemctl daemon-reload
git clone https://github.com/fares29-kh/location.git /opt/drivetn
```

Remettez le `.env` du gestionnaire de mots de passe dans `/opt/drivetn/.env`, puis :

```bash
chmod 600 /opt/drivetn/.env
cd /opt/drivetn
bash deploy/scripts/install-server.sh
bash deploy/scripts/restore-images.sh
bash deploy/scripts/up.sh
```

Le disque contient déjà la base, plus récente que la sauvegarde. On ne lance pas `restore-postgres.sh`.

### Le disque est perdu

Créez un disque neuf de 32 Go, attachez-le, et refaites le formatage et le montage de l'étape 4. Clonez le dépôt, remettez le `.env`, puis :

```bash
chmod 600 /opt/drivetn/.env
cd /opt/drivetn
bash deploy/scripts/install-server.sh
bash deploy/scripts/restore-images.sh
bash deploy/scripts/restore-postgres.sh LATEST
```

`up.sh` ne se lance pas avant `restore-postgres.sh` : un PostgreSQL vide écrirait dans les sauvegardes. Le script demande de retaper `madrasti.dev`, recharge la dernière base, rejoue les journaux, vide Redis et démarre le site. Les photos dans `drivetnmedia29ba25` restent en place.

Si le gestionnaire de mots de passe n'a pas le `.env`, une machine qui a `restic` le sort du compte de sauvegarde :

```bash
export AZURE_ACCOUNT_NAME=drivetnbackup29ba25
export AZURE_ACCOUNT_KEY=<clé du compte de sauvegarde>
export RESTIC_REPOSITORY=azure:drivetn-backups:/restic
export RESTIC_PASSWORD=<mot de passe restic du .env>
restic restore latest --target /tmp/drivetn-env
```

Le fichier est `/tmp/drivetn-env/opt/drivetn/.env`. Cette copie n'existe qu'après le premier `backup.sh`.

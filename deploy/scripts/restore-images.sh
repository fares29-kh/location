#!/usr/bin/env bash
# Télécharge les images Docker sauvegardées et les charge. À lancer sur un serveur neuf,
# avant up.sh, pour éviter une compilation de 30 à 45 minutes.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

workdir=/var/tmp/drivetn-images
rm -rf "$workdir"
mkdir -p "$workdir"

echo "Téléchargement des images..."
if is_azure; then
  az_backup "$workdir" download --name images/api.tar.gz --file /work/api.tar.gz
  az_backup "$workdir" download --name images/web.tar.gz --file /work/web.tar.gz
  az_backup "$workdir" download --name images/postgres.tar.gz --file /work/postgres.tar.gz
  az_backup "$workdir" download --name images/SHA256SUMS --file /work/SHA256SUMS
else
  s3 "$workdir" s3 cp "s3://${BACKUP_S3_BUCKET}/images/api.tar.gz" /work/api.tar.gz
  s3 "$workdir" s3 cp "s3://${BACKUP_S3_BUCKET}/images/web.tar.gz" /work/web.tar.gz
  s3 "$workdir" s3 cp "s3://${BACKUP_S3_BUCKET}/images/postgres.tar.gz" /work/postgres.tar.gz
  s3 "$workdir" s3 cp "s3://${BACKUP_S3_BUCKET}/images/SHA256SUMS" /work/SHA256SUMS
fi

(
  cd "$workdir"
  sha256sum -c SHA256SUMS
)
docker load -i "${workdir}/api.tar.gz"
docker load -i "${workdir}/web.tar.gz"
docker load -i "${workdir}/postgres.tar.gz"
rm -rf "$workdir"
echo "Images chargées."
echo "Disque de données intact : bash deploy/scripts/up.sh"
echo "Disque perdu : bash deploy/scripts/restore-postgres.sh LATEST, sans lancer up.sh avant."

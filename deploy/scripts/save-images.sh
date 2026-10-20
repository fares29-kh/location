#!/usr/bin/env bash
# Envoie les images déjà construites vers le bucket de sauvegarde.
# À relancer après chaque mise à jour du code, pour pouvoir remonter sans recompiler.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

avail_kb=$(df -Pk "${TMPDIR:-/tmp}" | awk 'NR == 2 { print $4 }')
if ((avail_kb < 4000000)); then
  echo "Moins de 4 Go libres : export annulé." >&2
  exit 1
fi

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

for image in drivetn-api:local drivetn-web:local drivetn-postgres:16; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "Image absente : $image. Lancez d'abord bash deploy/scripts/up.sh --build" >&2
    exit 1
  fi
done

echo "Export des images (plusieurs minutes, environ 1 à 2 Go)..."
docker save drivetn-api:local | gzip -1 >"${workdir}/api.tar.gz"
docker save drivetn-web:local | gzip -1 >"${workdir}/web.tar.gz"
docker save drivetn-postgres:16 | gzip -1 >"${workdir}/postgres.tar.gz"
(
  cd "$workdir"
  sha256sum api.tar.gz web.tar.gz postgres.tar.gz >SHA256SUMS
)

if is_azure; then
  echo "Envoi vers le conteneur Azure ${AZURE_BACKUP_CONTAINER}/images/"
  az_backup "$workdir" upload --file /work/api.tar.gz --name images/api.tar.gz --overwrite
  az_backup "$workdir" upload --file /work/web.tar.gz --name images/web.tar.gz --overwrite
  az_backup "$workdir" upload --file /work/postgres.tar.gz --name images/postgres.tar.gz --overwrite
  az_backup "$workdir" upload --file /work/SHA256SUMS --name images/SHA256SUMS --overwrite
else
  echo "Envoi vers s3://${BACKUP_S3_BUCKET}/images/"
  s3 "$workdir" s3 cp /work/api.tar.gz "s3://${BACKUP_S3_BUCKET}/images/api.tar.gz"
  s3 "$workdir" s3 cp /work/web.tar.gz "s3://${BACKUP_S3_BUCKET}/images/web.tar.gz"
  s3 "$workdir" s3 cp /work/postgres.tar.gz "s3://${BACKUP_S3_BUCKET}/images/postgres.tar.gz"
  s3 "$workdir" s3 cp /work/SHA256SUMS "s3://${BACKUP_S3_BUCKET}/images/SHA256SUMS"
fi
echo "Images enregistrées."

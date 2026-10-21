#!/usr/bin/env bash
# Fonctions partagées. Ce fichier est sourcé, pas exécuté.
set -euo pipefail

_lib_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "${_lib_dir}/../.." && pwd)
cd "$ROOT"

AWS_CLI_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:2.22.35}"
AZ_CLI_IMAGE="${AZ_CLI_IMAGE:-mcr.microsoft.com/azure-cli:2.67.0}"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Fichier manquant : $ROOT/.env" >&2
  echo "Lancez : bash deploy/scripts/init-env.sh" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

compose() {
  docker compose \
    -f "$ROOT/docker-compose.prod.yml" \
    -f "$ROOT/docker-compose.monitoring.yml" \
    --env-file "$ROOT/.env" \
    "$@"
}

# s3 <répertoire monté sur /work> <arguments aws>
# Les arguments commencent par le service (« s3 », « s3api »). L'endpoint ajouté
# est celui des sauvegardes (hel1), pas celui des photos.
s3() {
  local workdir=$1
  shift
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION="$BACKUP_S3_REGION" \
    -v "${workdir}:/work" \
    "$AWS_CLI_IMAGE" \
    --endpoint-url "$BACKUP_S3_ENDPOINT" \
    "$@"
}

is_azure() {
  [[ "${DEPLOY_TARGET:-hetzner}" == "azure" ]]
}

require_backup_config() {
  local missing=0
  local name
  local names
  if is_azure; then
    names=(AZURE_MEDIA_ACCOUNT AZURE_MEDIA_KEY AZURE_MEDIA_CONTAINER AZURE_BACKUP_ACCOUNT AZURE_BACKUP_KEY AZURE_BACKUP_CONTAINER WALG_AZ_PREFIX RESTIC_REPOSITORY RESTIC_PASSWORD POSTGRES_USER POSTGRES_DB)
  else
    names=(S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY BACKUP_S3_ENDPOINT BACKUP_S3_REGION BACKUP_S3_BUCKET WALG_S3_PREFIX RESTIC_REPOSITORY RESTIC_PASSWORD POSTGRES_USER POSTGRES_DB)
  fi
  for name in "${names[@]}"; do
    if [[ -z "${!name:-}" ]]; then
      echo "Variable vide : $name" >&2
      missing=1
    fi
  done
  if ((missing != 0)); then
    exit 1
  fi
}

# az_backup <répertoire monté sur /work> upload|download <arguments az storage blob>
az_backup() {
  local workdir=$1
  shift
  docker run --rm \
    -v "${workdir}:/work" \
    "$AZ_CLI_IMAGE" \
    az storage blob "$@" \
    --account-name "$AZURE_BACKUP_ACCOUNT" \
    --account-key "$AZURE_BACKUP_KEY" \
    --container-name "$AZURE_BACKUP_CONTAINER"
}

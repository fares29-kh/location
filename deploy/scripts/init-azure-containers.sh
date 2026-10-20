#!/usr/bin/env bash
# Crée les conteneurs Blob : photos à part, sauvegardes à part.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

create_container() {
  local account=$1
  local key=$2
  local name=$3
  local access=$4
  echo "Conteneur ${name} sur ${account} (accès : ${access})"
  docker run --rm \
    "$AZ_CLI_IMAGE" \
    az storage container create \
    --account-name "$account" \
    --account-key "$key" \
    --name "$name" \
    --public-access "$access"
}

echo "Si la création du conteneur public échoue, activez « Autoriser l'accès anonyme aux objets blob » sur le compte média, puis relancez."
create_container "$AZURE_MEDIA_ACCOUNT" "$AZURE_MEDIA_KEY" "$AZURE_MEDIA_CONTAINER" blob
create_container "$AZURE_MEDIA_ACCOUNT" "$AZURE_MEDIA_KEY" "${AZURE_MEDIA_CONTAINER_PRIVATE:-drivetn-private}" off
create_container "$AZURE_BACKUP_ACCOUNT" "$AZURE_BACKUP_KEY" "$AZURE_BACKUP_CONTAINER" off
echo "Conteneurs prêts."

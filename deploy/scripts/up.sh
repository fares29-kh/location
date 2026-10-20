#!/usr/bin/env bash
# Construit les images une par une (un VPS de 8 Go sature si tout part en parallèle), puis démarre.
# Sans argument : reconstruit seulement si une image manque. --build force la reconstruction.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [[ "${APP_DOMAIN:-}" == "localhost" || -z "${APP_DOMAIN:-}" ]]; then
  echo "APP_DOMAIN doit être le domaine public, pas localhost." >&2
  exit 1
fi
if [[ "${SEED_DEMO_ACCOUNTS:-false}" == "true" ]]; then
  echo "SEED_DEMO_ACCOUNTS=true est interdit en production." >&2
  exit 1
fi
if [[ "${COOKIE_SECURE:-}" != "true" ]]; then
  echo "COOKIE_SECURE doit valoir true." >&2
  exit 1
fi
if [[ -z "${ACME_EMAIL:-}" ]]; then
  echo "ACME_EMAIL est obligatoire." >&2
  exit 1
fi
if is_azure; then
  if [[ -z "${AZURE_MEDIA_KEY:-}" || -z "${AZURE_BACKUP_KEY:-}" || -z "${WALG_AZ_PREFIX:-}" ]]; then
    echo "Renseignez les clés des deux comptes de stockage Azure et WALG_AZ_PREFIX." >&2
    exit 1
  fi
elif [[ -z "${S3_ACCESS_KEY_ID:-}" || -z "${S3_SECRET_ACCESS_KEY:-}" || -z "${WALG_S3_PREFIX:-}" ]]; then
  echo "Les clés S3 et WALG_S3_PREFIX sont obligatoires." >&2
  exit 1
fi
if grep -q '__' "$ROOT/.env"; then
  echo ".env contient encore des marqueurs __ non remplacés." >&2
  exit 1
fi
if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PHONE:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "Avertissement : ADMIN_EMAIL, ADMIN_PHONE ou ADMIN_PASSWORD est vide. Aucun super-administrateur ne sera créé."
fi

build=0
if [[ "${1:-}" == "--build" ]]; then
  build=1
fi
for image in drivetn-postgres:16 drivetn-api:local drivetn-web:local; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    build=1
  fi
done

if ((build == 1)); then
  compose build postgres
  compose build api
  compose build web
fi

compose up -d
compose ps

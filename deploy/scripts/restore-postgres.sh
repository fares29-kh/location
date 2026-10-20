#!/usr/bin/env bash
# Remplace le répertoire de données PostgreSQL par une sauvegarde WAL-G.
# Usage : bash deploy/scripts/restore-postgres.sh <nom-de-sauvegarde|LATEST>
# N'utilisez PAS ce script si le volume de données est intact : démarrez simplement la pile.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

backup=${1:-}
if [[ -z "$backup" ]]; then
  echo "Usage : bash deploy/scripts/restore-postgres.sh LATEST" >&2
  echo "        bash deploy/scripts/restore-postgres.sh base_000000010000000000000007" >&2
  exit 1
fi

data_dir=${POSTGRES_DATA_DIR:-/var/lib/drivetn/postgres}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
aside="${data_dir}.avant-${stamp}"

echo "Cette commande arrête le site et REMPLACE ${data_dir}."
echo "L'ancienne copie sera conservée dans ${aside}."
echo "Tapez le domaine (${APP_DOMAIN}) pour confirmer :"
read -r answer
if [[ "$answer" != "$APP_DOMAIN" ]]; then
  echo "Confirmation incorrecte. Rien n'a été modifié." >&2
  exit 1
fi

mkdir -p /var/lock
exec 9>/var/lock/drivetn-backup.lock
if ! flock -w 60 9; then
  echo "Une sauvegarde est en cours. Attendez ou arrêtez-la." >&2
  exit 1
fi

compose stop api worker web
compose stop postgres

if [[ -d "$data_dir" ]]; then
  mv "$data_dir" "$aside"
fi
mkdir -p "$data_dir"
chown 999:999 "$data_dir"
chmod 700 "$data_dir"

if ! compose run --rm --no-deps --user postgres --entrypoint wal-g postgres \
  backup-fetch /var/lib/postgresql/data "$backup"; then
  echo "Le téléchargement a échoué. L'ancienne base est intacte dans ${aside}." >&2
  exit 1
fi

compose run --rm --no-deps --user postgres --entrypoint bash postgres -c \
  'touch /var/lib/postgresql/data/recovery.signal'

compose up -d postgres

echo "Rejeu des journaux WAL..."
for _ in $(seq 1 180); do
  state=$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();" 2>/dev/null || true)
  state=${state//[[:space:]]/}
  if [[ "$state" == "f" ]]; then
    break
  fi
  sleep 10
done

recovery=$(compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery();" || true)
recovery=${recovery//[[:space:]]/}
if [[ "$recovery" != "f" ]]; then
  echo "La base est encore en restauration après 30 minutes. Regardez : docker compose -f docker-compose.prod.yml logs postgres" >&2
  exit 1
fi

compose up -d redis
flushed=0
for _ in $(seq 1 30); do
  if compose exec -T redis redis-cli FLUSHALL; then
    flushed=1
    break
  fi
  sleep 2
done
if ((flushed == 0)); then
  echo "Redis n'a pas démarré. La base est restaurée, le site n'a pas été relancé." >&2
  exit 1
fi
compose up -d
echo "Base restaurée depuis ${backup}. Ancienne copie : ${aside}."
echo "Redis a été vidé : les SMS en file d'attente au moment de la panne ne seront pas renvoyés."

#!/usr/bin/env bash
# Sauvegarde complète : base WAL-G (en plus de l'archivage continu) et copie chiffrée de .env.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

mkdir -p /var/lock
exec 9>/var/lock/drivetn-backup.lock
if ! flock -w 3600 9; then
  echo "Impossible de prendre le verrou de sauvegarde." >&2
  exit 1
fi

failed=1
cleanup() {
  if ((failed == 1)) && [[ -n "${HEALTHCHECKS_URL:-}" ]]; then
    curl -fsS -m 10 --retry 2 "${HEALTHCHECKS_URL}/fail" || true
  fi
}
trap cleanup EXIT

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Sauvegarde de la base"
compose exec -T -u postgres postgres wal-g backup-push /var/lib/postgresql/data
compose exec -T -u postgres postgres wal-g delete retain FULL 7 --confirm

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Copie chiffrée de .env"
# shellcheck disable=SC1091
source "${_lib_dir}/ensure-restic.sh"
ensure_restic
export RESTIC_REPOSITORY RESTIC_PASSWORD
restic_opts=()
if is_azure; then
  export AZURE_ACCOUNT_NAME="$AZURE_BACKUP_ACCOUNT"
  export AZURE_ACCOUNT_KEY="$AZURE_BACKUP_KEY"
else
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"
  restic_opts=(-o s3.bucket-lookup=path)
fi
if ! restic "${restic_opts[@]}" cat config >/dev/null 2>&1; then
  restic "${restic_opts[@]}" init
fi
restic "${restic_opts[@]}" backup --tag drivetn-env "$ROOT/.env"
restic "${restic_opts[@]}" forget --keep-daily 14 --keep-weekly 8 --keep-monthly 6 --prune

bash "${_lib_dir}/check-archive.sh" --locked

date -u +%Y-%m-%dT%H:%M:%SZ >/var/lib/drivetn/last-backup-ok
bash "${_lib_dir}/write-metrics.sh" || true
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Sauvegarde terminée"
if [[ -n "${HEALTHCHECKS_URL:-}" ]]; then
  curl -fsS -m 10 --retry 2 "$HEALTHCHECKS_URL" || true
fi
failed=0

#!/usr/bin/env bash
# Écrit les mesures de sauvegarde lues par node-exporter (format Prometheus).
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

metrics_dir=/var/lib/drivetn/metrics
mkdir -p "$metrics_dir"
chmod 755 "$metrics_dir"

backup_ts=0
if [[ -f /var/lib/drivetn/last-backup-ok ]]; then
  raw=$(tr -d '[:space:]' </var/lib/drivetn/last-backup-ok)
  if parsed=$(date -u -d "$raw" +%s 2>/dev/null); then
    backup_ts=$parsed
  fi
fi

wal_ok=0
pg_ok=0
if result=$(
  compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    "SELECT CASE WHEN last_failed_time IS NOT NULL AND (last_archived_time IS NULL OR last_failed_time > last_archived_time) THEN 'FAIL' ELSE 'OK' END FROM pg_stat_archiver;" \
    2>/dev/null
); then
  pg_ok=1
  result=${result//[[:space:]]/}
  if [[ "$result" == "OK" ]]; then
    wal_ok=1
  fi
fi

tmp=$(mktemp "$metrics_dir/drivetn.prom.XXXXXX")
cat >"$tmp" <<EOF
# HELP drivetn_backup_last_success_timestamp_seconds Horodatage Unix de la dernière sauvegarde complète réussie.
# TYPE drivetn_backup_last_success_timestamp_seconds gauge
drivetn_backup_last_success_timestamp_seconds ${backup_ts}
# HELP drivetn_postgres_up 1 si PostgreSQL répond.
# TYPE drivetn_postgres_up gauge
drivetn_postgres_up ${pg_ok}
# HELP drivetn_wal_archive_ok 1 si le dernier archivage WAL a réussi.
# TYPE drivetn_wal_archive_ok gauge
drivetn_wal_archive_ok ${wal_ok}
EOF
chmod 644 "$tmp"
mv -f "$tmp" "$metrics_dir/drivetn.prom"

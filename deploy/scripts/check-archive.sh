#!/usr/bin/env bash
# Vérifie que le dernier archivage WAL a réussi. --locked : le verrou est déjà tenu par backup.sh.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

locked=0
if [[ "${1:-}" == "--locked" ]]; then
  locked=1
fi

if ((locked == 0)); then
  mkdir -p /var/lock
  exec 9>/var/lock/drivetn-backup.lock
  if ! flock -n 9; then
    exit 0
  fi
  failed=1
  trap 'if ((failed == 1)) && [[ -n "${HEALTHCHECKS_URL:-}" ]]; then curl -fsS -m 10 --retry 2 "${HEALTHCHECKS_URL}/fail" || true; fi' EXIT
fi

compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT last_archived_time, last_failed_time, failed_count FROM pg_stat_archiver;"

result=$(
  compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    "SELECT CASE WHEN last_failed_time IS NOT NULL AND (last_archived_time IS NULL OR last_failed_time > last_archived_time) THEN 'FAIL' ELSE 'OK' END FROM pg_stat_archiver;"
)
result=${result//[[:space:]]/}
if [[ "$result" != "OK" ]]; then
  echo "Archivage WAL en échec. Les journaux Postgres ne partent plus vers le stockage de sauvegarde." >&2
  exit 1
fi
failed=0

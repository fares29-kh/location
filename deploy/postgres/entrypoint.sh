#!/usr/bin/env bash
# Active l'archivage continu des WAL avant le point d'entrée officiel.
# Il faut un préfixe S3 (Hetzner) ou Azure. Sans copie hors du serveur, on refuse de démarrer.
set -euo pipefail

if [ "${1:-}" = "postgres" ]; then
  az_prefix=${WALG_AZ_PREFIX:-}
  s3_prefix=${WALG_S3_PREFIX:-}
  if [ -n "$az_prefix" ] && [ -n "$s3_prefix" ]; then
    echo "[postgres] WALG_AZ_PREFIX et WALG_S3_PREFIX sont tous les deux définis." >&2
    exit 1
  fi
  if [ -z "$az_prefix" ] && [ -z "$s3_prefix" ]; then
    echo "[postgres] Aucun préfixe WAL. Refus de démarrer sans archivage." >&2
    exit 1
  fi
  if [ -n "$az_prefix" ]; then
    unset AWS_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY WALG_S3_PREFIX
  else
    unset WALG_AZ_PREFIX AZURE_STORAGE_ACCOUNT AZURE_STORAGE_ACCESS_KEY
  fi
  shift
  exec docker-entrypoint.sh postgres \
    -c wal_level=replica \
    -c archive_mode=on \
    -c archive_timeout=60 \
    -c archive_command='wal-g wal-push %p' \
    -c restore_command='wal-g wal-fetch %f %p' \
    -c max_connections=50 \
    -c shared_buffers=256MB \
    -c effective_cache_size=2GB \
    -c work_mem=8MB \
    -c maintenance_work_mem=128MB \
    -c checkpoint_timeout=10min \
    -c max_wal_size=1GB \
    -c wal_compression=on \
    -c timezone=UTC \
    -c log_timezone=UTC \
    -c log_line_prefix='%m [%p] ' \
    "$@"
fi

exec docker-entrypoint.sh "$@"

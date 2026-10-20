#!/usr/bin/env bash
# Relit la dernière sauvegarde dans un dossier temporaire, sans toucher à la base en service.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

tmp=/var/tmp/drivetn-verify-backup
rm -rf "$tmp"
mkdir -p "$tmp"
chown 999:999 "$tmp"
chmod 700 "$tmp"

echo "Téléchargement de LATEST vers ${tmp} (la base en service n'est pas modifiée)..."
if ! compose run --rm --no-deps --user postgres --entrypoint wal-g -v "${tmp}:/verify" postgres \
  backup-fetch /verify LATEST; then
  rm -rf "$tmp"
  echo "Impossible de relire la sauvegarde." >&2
  exit 1
fi

if [[ ! -f "${tmp}/PG_VERSION" ]]; then
  rm -rf "$tmp"
  echo "Archive téléchargée, mais PG_VERSION est absent." >&2
  exit 1
fi
rm -rf "$tmp"
echo "La dernière sauvegarde de base a pu être relue."

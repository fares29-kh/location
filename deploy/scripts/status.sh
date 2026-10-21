#!/usr/bin/env bash
# État de la pile, de l'archivage WAL et de la dernière sauvegarde complète.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

compose ps
echo
if [[ -f /var/lib/drivetn/last-backup-ok ]]; then
  echo "Dernière sauvegarde complète : $(cat /var/lib/drivetn/last-backup-ok)"
else
  echo "Aucune sauvegarde complète enregistrée. Lancez : bash deploy/scripts/backup.sh"
fi
echo
echo "Archives WAL :"
compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT last_archived_time, last_failed_time, failed_count FROM pg_stat_archiver;"
echo
echo "Tableau de bord : https://admin.${APP_DOMAIN}/monitoring"
echo "Identifiant Grafana : ${GRAFANA_ADMIN_USER:-admin}"
echo
echo "Sauvegardes de base :"
compose exec -T -u postgres postgres wal-g backup-list || true

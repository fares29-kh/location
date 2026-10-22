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
if [[ -z "${GRAFANA_ADMIN_PASSWORD:-}" || ${#GRAFANA_ADMIN_PASSWORD} -lt 16 ]]; then
  echo 'GRAFANA_ADMIN_PASSWORD est obligatoire (16 caractères minimum, sans $).' >&2
  exit 1
fi
if [[ "$GRAFANA_ADMIN_PASSWORD" == *'$'* ]]; then
  echo 'GRAFANA_ADMIN_PASSWORD ne doit pas contenir $.' >&2
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

if [[ "$(id -u)" -eq 0 ]]; then
  mkdir -p /var/lib/drivetn/metrics
  chmod 755 /var/lib/drivetn/metrics
  cat >/etc/cron.d/drivetn <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 2 * * * root /usr/bin/bash ${ROOT}/deploy/scripts/backup.sh >> /var/log/drivetn-backup.log 2>&1
20 * * * * root /usr/bin/bash ${ROOT}/deploy/scripts/check-archive.sh >> /var/log/drivetn-backup.log 2>&1
*/5 * * * * root /usr/bin/bash ${ROOT}/deploy/scripts/write-metrics.sh >> /var/log/drivetn-backup.log 2>&1
EOF
  chmod 644 /etc/cron.d/drivetn
fi

# Contrôles HTTPS : Traefik est joint sur le réseau Docker, avec le nom du certificat.
# Évite le retour par l'adresse publique, qui échoue souvent depuis la VM elle-même.
if [[ ! "$APP_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "APP_DOMAIN ne contient pas un nom de domaine utilisable." >&2
  exit 1
fi
mkdir -p /var/lib/drivetn/monitoring
if [[ -d /var/lib/drivetn/monitoring/https.yml || -d /var/lib/drivetn/monitoring/blackbox.yml || -d /var/lib/drivetn/monitoring/alertmanager.yml ]]; then
  echo "Un démarrage précédent a créé un dossier à la place du fichier de sondes." >&2
  echo "Supprimez-le, puis relancez : rm -rf /var/lib/drivetn/monitoring/https.yml /var/lib/drivetn/monitoring/blackbox.yml /var/lib/drivetn/monitoring/alertmanager.yml" >&2
  exit 1
fi
cat >/var/lib/drivetn/monitoring/https.yml <<EOF
- targets: ['https://traefik:443']
  labels:
    module: https_agency
    site: https://agency.${APP_DOMAIN}/
- targets: ['https://traefik:443']
  labels:
    module: https_app
    site: https://app.${APP_DOMAIN}/
- targets: ['https://traefik:443']
  labels:
    module: https_admin
    site: https://admin.${APP_DOMAIN}/
- targets: ['https://traefik:443']
  labels:
    module: https_apex
    site: https://${APP_DOMAIN}/
EOF
cat >/var/lib/drivetn/monitoring/blackbox.yml <<EOF
modules:
  https_agency:
    prober: http
    timeout: 10s
    http:
      valid_status_codes: [200, 301, 302, 307, 308]
      method: GET
      follow_redirects: false
      fail_if_not_ssl: true
      headers:
        Host: agency.${APP_DOMAIN}
      tls_config:
        server_name: agency.${APP_DOMAIN}
  https_app:
    prober: http
    timeout: 10s
    http:
      valid_status_codes: [200, 301, 302, 307, 308]
      method: GET
      follow_redirects: false
      fail_if_not_ssl: true
      headers:
        Host: app.${APP_DOMAIN}
      tls_config:
        server_name: app.${APP_DOMAIN}
  https_admin:
    prober: http
    timeout: 10s
    http:
      valid_status_codes: [200, 301, 302, 307, 308]
      method: GET
      follow_redirects: false
      fail_if_not_ssl: true
      headers:
        Host: admin.${APP_DOMAIN}
      tls_config:
        server_name: admin.${APP_DOMAIN}
  https_apex:
    prober: http
    timeout: 10s
    http:
      valid_status_codes: [200, 301, 302, 307, 308]
      method: GET
      follow_redirects: false
      fail_if_not_ssl: true
      headers:
        Host: ${APP_DOMAIN}
      tls_config:
        server_name: ${APP_DOMAIN}
EOF
chmod 644 /var/lib/drivetn/monitoring/https.yml /var/lib/drivetn/monitoring/blackbox.yml

# Les alertes partent par le SMTP du .env. Le mot de passe n'est pas dans le dépôt.
if [[ -n "${SMTP_USER:-}" && -n "${SMTP_PASSWORD:-}" ]]; then
  smtp_pass=${SMTP_PASSWORD//\\/\\\\}
  smtp_pass=${smtp_pass//\"/\\\"}
  {
    printf '%s\n' 'global:' '  resolve_timeout: 5m'
    printf '  smtp_smarthost: "%s:%s"\n' "${SMTP_HOST:-smtp.gmail.com}" "${SMTP_PORT:-587}"
    printf '  smtp_from: "%s"\n' "$SMTP_USER"
    printf '  smtp_auth_username: "%s"\n' "$SMTP_USER"
    printf '  smtp_auth_password: "%s"\n' "$smtp_pass"
    printf '%s\n' '  smtp_require_tls: true' 'route:' '  receiver: gmail' "  group_by: ['alertname']" '  group_wait: 30s' '  group_interval: 5m' '  repeat_interval: 4h' 'receivers:' '  - name: gmail' '    email_configs:'
    printf '      - to: "%s"\n' "$SMTP_USER"
    printf '%s\n' '        send_resolved: true'
  } >/var/lib/drivetn/monitoring/alertmanager.yml
else
  echo "SMTP_USER ou SMTP_PASSWORD est vide : les alertes restent dans Grafana, aucun e-mail." >&2
  cat >/var/lib/drivetn/monitoring/alertmanager.yml <<'EOF'
route:
  receiver: vide
receivers:
  - name: vide
EOF
fi
chmod 644 /var/lib/drivetn/monitoring/alertmanager.yml

compose up -d
compose ps

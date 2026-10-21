#!/usr/bin/env bash
# Crée .env à la racine du dépôt avec des secrets aléatoires. Ne remplace pas un .env existant.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT"

if [[ -f .env ]]; then
  echo ".env existe déjà. Rien n'a été modifié." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl est requis." >&2
  exit 1
fi

suffix=$(openssl rand -hex 3)
pg=$(openssl rand -hex 24)
redis=$(openssl rand -hex 24)
jwt=$(openssl rand -hex 32)
otp=$(openssl rand -hex 32)
restic=$(openssl rand -hex 32)
grafana=$(openssl rand -hex 24)

target=${1:-hetzner}
case "$target" in
  hetzner) template=deploy/.env.example ;;
  azure) template=deploy/.env.azure.example ;;
  *)
    echo "Usage : bash deploy/scripts/init-env.sh [hetzner|azure]" >&2
    exit 1
    ;;
esac

umask 077
sed \
  -e "s/__SUFFIX__/${suffix}/g" \
  -e "s/__POSTGRES_PASSWORD__/${pg}/g" \
  -e "s/__REDIS_PASSWORD__/${redis}/g" \
  -e "s/__JWT_ACCESS_SECRET__/${jwt}/g" \
  -e "s/__OTP_HASH_SECRET__/${otp}/g" \
  -e "s/__RESTIC_PASSWORD__/${restic}/g" \
  -e "s/__GRAFANA_ADMIN_PASSWORD__/${grafana}/g" \
  "$template" >.env
chmod 600 .env

echo ".env créé pour ${target} (droits 600)."
echo "Copiez-le maintenant dans votre gestionnaire de mots de passe, en particulier RESTIC_PASSWORD."
if [[ "$target" == "azure" ]]; then
  echo "Puis renseignez APP_DOMAIN, ACME_EMAIL, les deux clés Azure et le compte administrateur."
  echo "GRAFANA_ADMIN_PASSWORD est déjà généré : c'est le mot de passe du tableau de bord."
else
  echo "Puis renseignez APP_DOMAIN, ACME_EMAIL, les clés S3 et le compte administrateur."
fi

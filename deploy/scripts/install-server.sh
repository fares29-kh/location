#!/usr/bin/env bash
# Prépare un Ubuntu 24.04 : Docker, pare-feu, swap, cron des sauvegardes.
# À lancer en root depuis le dépôt déjà cloné : bash deploy/scripts/install-server.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lancez ce script avec sudo ou en root." >&2
  exit 1
fi

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg git ufw restic cron openssl

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  source /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
systemctl enable --now cron

if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab

mkdir -p /var/lib/drivetn/postgres /var/lib/drivetn/redis /var/log
# uid 999 = utilisateur postgres de l'image officielle, et utilisateur redis.
chown 999:999 /var/lib/drivetn/postgres /var/lib/drivetn/redis
chmod 700 /var/lib/drivetn/postgres /var/lib/drivetn/redis

if ! findmnt -n /var/lib/drivetn >/dev/null 2>&1; then
  echo
  echo "ATTENTION : /var/lib/drivetn n'est pas un volume séparé."
  echo "PostgreSQL est sur le disque du serveur. Si ce disque disparaît, la remontée"
  echo "passe par les sauvegardes WAL (perte maximale d'environ une minute)."
  echo
fi

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat >/etc/cron.d/drivetn <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 2 * * * root /usr/bin/bash ${ROOT}/deploy/scripts/backup.sh >> /var/log/drivetn-backup.log 2>&1
20 * * * * root /usr/bin/bash ${ROOT}/deploy/scripts/check-archive.sh >> /var/log/drivetn-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/drivetn

cat >/etc/logrotate.d/drivetn <<'EOF'
/var/log/drivetn-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF

echo "Serveur prêt. Suite : bash deploy/scripts/init-env.sh"

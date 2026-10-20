#!/usr/bin/env bash
# Ajoute l'IPv4 flottante Hetzner sur l'interface par défaut et la conserve au redémarrage.
# Usage : sudo bash deploy/scripts/hetzner-floating-ip.sh 203.0.113.10
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lancez ce script en root." >&2
  exit 1
fi

ip=${1:-}
if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage : bash deploy/scripts/hetzner-floating-ip.sh <ipv4>" >&2
  exit 1
fi

iface=$(ip route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit }}')
if [[ -z "$iface" ]]; then
  echo "Interface par défaut introuvable." >&2
  exit 1
fi

cat >/etc/netplan/60-drivetn-floating-ip.yaml <<EOF
network:
  version: 2
  ethernets:
    ${iface}:
      addresses:
        - ${ip}/32
EOF
chmod 600 /etc/netplan/60-drivetn-floating-ip.yaml
netplan apply
echo "IPv4 ${ip} configurée sur ${iface}."

# Installe le binaire officiel de restic. Le paquet Ubuntu retire Azure,
# ce qui produit « invalid backend » sur azure:drivetn-backups:/restic.
ensure_restic() {
  local probe=""
  if command -v restic >/dev/null 2>&1; then
    probe=$(restic -r 'azure:x:/' cat config 2>&1 || true)
    if [[ "$probe" != *"invalid backend"* ]]; then
      return 0
    fi
  fi
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Le restic du système ne sait pas parler à Azure. Relancez en root." >&2
    return 1
  fi
  if [[ "$(uname -m)" != "x86_64" ]]; then
    echo "Architecture non gérée pour restic : $(uname -m)" >&2
    return 1
  fi
  if ! command -v bunzip2 >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y bzip2
  fi
  local version=0.18.1
  local sum=680838f19d67151adba227e1570cdd8af12c19cf1735783ed1ba928bc41f363d
  local tmp
  tmp=$(mktemp -d)
  curl -fsSL \
    "https://github.com/restic/restic/releases/download/v${version}/restic_${version}_linux_amd64.bz2" \
    -o "$tmp/restic.bz2"
  echo "${sum}  $tmp/restic.bz2" | sha256sum -c -
  bunzip2 -c "$tmp/restic.bz2" >/usr/local/bin/restic
  chmod 755 /usr/local/bin/restic
  rm -rf "$tmp"
  hash -r
  restic version
}

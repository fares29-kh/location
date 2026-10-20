#!/usr/bin/env bash
# Crée les buckets (Hetzner) ou les conteneurs Blob (Azure), selon DEPLOY_TARGET.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_backup_config

if is_azure; then
  exec bash "$ROOT/deploy/scripts/init-azure-containers.sh"
fi

for name in S3_ENDPOINT S3_REGION S3_BUCKET_PUBLIC S3_BUCKET_PRIVATE; do
  if [[ -z "${!name:-}" ]]; then
    echo "Variable vide : $name" >&2
    exit 1
  fi
done

create_bucket() {
  local bucket=$1
  local endpoint=$2
  local region=$3
  if docker run --rm \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION="$region" \
    "$AWS_CLI_IMAGE" \
    --endpoint-url "$endpoint" \
    s3 ls "s3://${bucket}" >/dev/null 2>&1; then
    echo "Déjà présent : ${bucket}"
    return 0
  fi
  echo "Création de ${bucket} sur ${endpoint}"
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e AWS_DEFAULT_REGION="$region" \
    "$AWS_CLI_IMAGE" \
    --endpoint-url "$endpoint" \
    s3 mb "s3://${bucket}"
}

create_bucket "$S3_BUCKET_PUBLIC" "$S3_ENDPOINT" "$S3_REGION"
create_bucket "$S3_BUCKET_PRIVATE" "$S3_ENDPOINT" "$S3_REGION"
create_bucket "$BACKUP_S3_BUCKET" "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_REGION"

policy=$(mktemp)
sed "s/BUCKET_NAME/${S3_BUCKET_PUBLIC}/g" "$ROOT/deploy/policies/public-read.json" >"$policy"
echo "Politique de lecture publique sur ${S3_BUCKET_PUBLIC}"
if ! docker run --rm \
  -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION="$S3_REGION" \
  -v "${policy}:/policy.json:ro" \
  "$AWS_CLI_IMAGE" \
  --endpoint-url "$S3_ENDPOINT" \
  s3api put-bucket-policy --bucket "$S3_BUCKET_PUBLIC" --policy file:///policy.json; then
  rm -f "$policy"
  echo "La politique publique a été refusée. Dans la console Hetzner, passez le bucket ${S3_BUCKET_PUBLIC} en visibilité Public." >&2
  exit 1
fi
rm -f "$policy"
echo "Buckets prêts."

#!/bin/sh
# Crée les buckets S3 au premier démarrage (idempotent).
# - bucket public  : photos de véhicules, logos (lecture anonyme)
# - bucket privé   : CIN, passeports, permis, preuves d'avance (URLs signées uniquement)
set -eu

export MC_CONFIG_DIR=/tmp/.mc

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  echo "[minio-init] En attente de MinIO..."
  sleep 2
done

mc mb --ignore-existing "local/$S3_BUCKET_PUBLIC" "local/$S3_BUCKET_PRIVATE"
mc anonymous set download "local/$S3_BUCKET_PUBLIC"
mc anonymous set none "local/$S3_BUCKET_PRIVATE"

echo "[minio-init] Buckets prêts : $S3_BUCKET_PUBLIC (public), $S3_BUCKET_PRIVATE (privé)"

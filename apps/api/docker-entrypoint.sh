#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Application des migrations Prisma..."
  ./node_modules/.bin/prisma migrate deploy
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Seed des données de base..."
  node dist/seed/seed.js
fi

exec "$@"

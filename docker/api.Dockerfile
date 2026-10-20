# syntax=docker/dockerfile:1.7
# Image de l'API NestJS et du worker BullMQ (même image, point d'entrée différent).

ARG NODE_VERSION=22
ARG PNPM_VERSION=9.15.9

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV HUSKY=0 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1
RUN apk add --no-cache libc6-compat openssl \
 && npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}
WORKDIR /repo

# --- Dépendances : couche réutilisée tant que les manifestes ne changent pas ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY .husky/install.mjs .husky/install.mjs
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@drivetn/api..."

# --- Développement : sources montées en volume, hot-reload ---
FROM deps AS dev
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @drivetn/types build && pnpm --filter @drivetn/api prisma:generate
EXPOSE 4000

# --- Build de production ---
FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @drivetn/types build \
 && pnpm --filter @drivetn/api prisma:generate \
 && pnpm --filter @drivetn/api build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @drivetn/api deploy --prod --store-dir /pnpm/store /out
WORKDIR /out
RUN ./node_modules/.bin/prisma generate

# --- Image finale : uniquement le code compilé et les dépendances de production ---
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

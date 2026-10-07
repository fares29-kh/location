# syntax=docker/dockerfile:1.7
# Image du front Next.js (les 3 portails sont servis par la même application).

ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.9

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat \
 && npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}
WORKDIR /repo

# --- Dépendances ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY .husky/install.mjs .husky/install.mjs
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@drivetn/web..."

# --- Développement : sources montées en volume, hot-reload ---
FROM deps AS dev
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @drivetn/types build
EXPOSE 3000

# --- Build de production (sortie standalone) ---
FROM deps AS build
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @drivetn/types build && pnpm --filter @drivetn/web build

# --- Image finale ---
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

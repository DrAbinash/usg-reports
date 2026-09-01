# CARE USG Studio — Synology ARM-ready image
# Same hardened pattern as the mri-reports app (node:20-alpine multi-arch).

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies first (layer cache). npm ci uses the lockfile for exact versions.
# --ignore-scripts skips postinstall hooks; prisma generate runs separately below.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Prisma schema + client BEFORE source — downloads the correct engine binary
# for Alpine/musl on the build architecture (ARM64 on Synology).
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source and build the standalone output
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ---- Prisma CLI stage ----
# prisma 6.16+ CLI depends on @prisma/config -> effect / c12 / … (a deep
# transitive chain). The runner needs a COMPLETE prisma install for the
# entrypoint's `prisma db push` — cherry-picking node_modules folders breaks
# it (that caused the 2026-08-30 "Cannot find module 'effect'" crash loop).
# The version is read from package-lock.json so it always matches the app.
FROM node:20-alpine AS prisma-cli
COPY package-lock.json /tmp/lock.json
WORKDIR /prisma-cli
RUN PRISMA_VER=$(node -p "require('/tmp/lock.json').packages['node_modules/prisma'].version") \
    && npm install "prisma@$PRISMA_VER" --no-audit --no-fund --loglevel=error

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/db/studio.db

# Standalone server + static assets + public files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# COMPLETE prisma CLI install (prisma + @prisma/* + effect/c12/… transitive
# deps + engine binaries) so the entrypoint can `prisma db push` on boot.
# Docker COPY merges directories — the standalone trace below is preserved.
COPY --from=prisma-cli /prisma-cli/node_modules ./node_modules

# Generated prisma client + engines from the builder — belt & suspenders on
# top of the standalone trace, which already bundles @prisma/client.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/prisma ./prisma

# v4 USG-only migration helper — run by the entrypoint before `db push`.
COPY scripts/usg-v4-cleanup.mjs ./scripts/usg-v4-cleanup.mjs
# v6.1 worklist-identity helper — run by the entrypoint AFTER `db push`
# (blank accessionNumber "" → NULL + duplicate-identity diagnostics).
COPY scripts/usg-v7-null-accession.mjs ./scripts/usg-v7-null-accession.mjs

# Entrypoint: prepare DB, then start the standalone server
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /app/data/db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]

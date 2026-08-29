# CARE Reporting Studio — Synology ARM-ready image
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

# Prisma client + CLI so the entrypoint can `prisma db push` on boot
# (creates/updates the SQLite schema idempotently, matching the app).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/prisma ./prisma

# Entrypoint: prepare DB, then start the standalone server
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /app/data/db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]

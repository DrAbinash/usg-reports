# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install bun — the project uses bun.lock, not package-lock.json
# This is critical for Synology: ensures reproducible builds on any architecture
RUN npm install -g bun@1

# Copy dependency manifests first (Docker layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy Prisma schema and generate client BEFORE copying source
# This ensures the correct engine binary for Alpine/musl is downloaded
COPY prisma ./prisma/
RUN bunx prisma generate

# Copy source and build
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js standalone output
RUN bun run build

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install sqlite3 CLI for runtime DB table creation and tini for signal handling
RUN apk add --no-cache sqlite tini

# Copy built standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma runtime files — engine binary + generated client
# The engine binary is platform-specific and MUST match the target architecture
# Since both stages use node:20-alpine, the binary is correct
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy SQL schema for entrypoint DB setup
COPY schema.sql /app/schema.sql

# Create data directories
RUN mkdir -p /app/data/db /app/data/studies /app/data/exports

# Copy and set up entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/db/usg_companion.db"
ENV TZ=Asia/Kolkata

ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
#!/bin/sh
set -e

echo "========================================="
echo "[studio] CARE Reporting Studio starting..."
echo "[studio] Node.js: $(node --version)  Platform: $(uname -m)"
echo "========================================="

mkdir -p /app/data/db

# Create or migrate the SQLite schema (idempotent — safe on every boot).
echo "[studio] Applying database schema…"
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null \
  || ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss

echo "[studio] Starting server on :3000"
exec "$@"

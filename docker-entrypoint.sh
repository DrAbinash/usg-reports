#!/bin/sh
set -e

echo "========================================="
echo "[studio] CARE Reporting Studio starting..."
echo "[studio] Node.js: $(node --version)  Platform: $(uname -m)"
echo "========================================="

mkdir -p /app/data/db

# Create or migrate the SQLite schema (idempotent — safe on every boot).
# The prisma CLI ships with its FULL dependency closure (see Dockerfile
# prisma-cli stage), so the local binary just works. Never fall back to
# `npx` — that would fetch a random registry version.
echo "[studio] Applying database schema…"
PRISMA="./node_modules/.bin/prisma"
if [ ! -x "$PRISMA" ]; then
  PRISMA="node ./node_modules/prisma/build/index.js"
fi

n=0
until $PRISMA db push --skip-generate --accept-data-loss; do
  n=$((n + 1))
  if [ "$n" -ge 3 ]; then
    echo "[studio] WARNING: schema push failed 3x — starting the server anyway." >&2
    echo "[studio] If this is the FIRST boot the schema is missing and pages will" >&2
    echo "[studio] error — check the logs above. Diagnostics:" >&2
    $PRISMA -v || true
    break
  fi
  echo "[studio] schema push failed — retrying in 5s (attempt $n/3)…" >&2
  sleep 5
done

echo "[studio] Starting server on :3000"
exec "$@"

#!/bin/sh
set -e

echo "========================================="
echo "[studio] CARE Reporting Studio starting..."
echo "[studio] Node.js: $(node --version)  Platform: $(uname -m)"
echo "========================================="

mkdir -p /app/data/db

# Apply the SQLite schema (idempotent — safe on every boot).
#
# NO --accept-data-loss: this database holds finalized medical reports.
# - additive changes (new tables/columns) apply automatically;
# - a change that would DROP data makes prisma exit non-zero — we then FAIL
#   STARTUP deliberately instead of destroying clinical data. Fix the schema
#   conflict manually (backup ./data/db first), then restart.
echo "[studio] Applying database schema…"
PRISMA="./node_modules/.bin/prisma"
if [ ! -x "$PRISMA" ]; then
  PRISMA="node ./node_modules/prisma/build/index.js"
fi

n=0
until $PRISMA db push --skip-generate; do
  n=$((n + 1))
  if [ "$n" -ge 3 ]; then
    echo "=============================================" >&2
    echo "[studio] FATAL: schema push failed 3 times." >&2
    echo "[studio] Startup is being stopped on purpose:" >&2
    echo "[studio]  - if the error mentions a possible data loss / reset," >&2
    echo "[studio]    prisma was asked NOT to destroy data (report DB!)." >&2
    echo "[studio]  - back up ./data/db, resolve the schema conflict," >&2
    echo "[studio]    then restart the container." >&2
    echo "=============================================" >&2
    $PRISMA -v || true
    exit 1
  fi
  echo "[studio] schema push failed — retrying in 5s (attempt $n/3)…" >&2
  sleep 5
done

echo "[studio] Starting server on :3000"
exec "$@"

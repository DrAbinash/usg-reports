#!/bin/sh
set -e

echo "========================================="
echo "[studio] CARE USG Studio starting..."
echo "[studio] Node.js: $(node --version)  Platform: $(uname -m)"
echo "========================================="

mkdir -p /app/data/db

# v4 (USG-only): remove the legacy v1–v3 radiology structures so the
# schema push below never needs a destructive change. Idempotent; USG
# reports, custom pathologies, settings and sessions are never touched.
# On a fresh or already-migrated database this is a fast no-op.
if [ -f /app/scripts/usg-v4-cleanup.mjs ]; then
  echo "[studio] Legacy radiology cleanup check (v4 USG-only)…"
  node /app/scripts/usg-v4-cleanup.mjs || echo "[studio] v4 cleanup did not run — continuing (db push is the real gate)" >&2
fi

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

# v6.1 — AFTER the push (column already nullable): canonicalise blank
# accession numbers to NULL and report duplicate-identity diagnostics.
# Never fatal — a helper must not take the clinic down.
if [ -f /app/scripts/usg-v7-null-accession.mjs ]; then
  echo "[studio] Worklist identity check (v6.1)…"
  node /app/scripts/usg-v7-null-accession.mjs || echo "[studio] v7 check did not run — continuing" >&2
fi

echo "[studio] Starting server on :3000"
exec "$@"

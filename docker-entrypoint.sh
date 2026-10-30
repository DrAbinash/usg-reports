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

# Regenerate the client from THIS image's schema before anything touches the
# database. A generated client that lags its schema rejects every write with
# "Unknown argument" while reads keep working — so the studio looks healthy,
# the sync logs HTTP 200, and the worklist silently stops growing. `db push
# --skip-generate` below deliberately does not regenerate, so this is the one
# step that can catch a stale client baked into an image by a reused build
# layer. Cost is about a second on boot.
echo "[studio] Regenerating Prisma client from prisma/schema.prisma…"
if ! $PRISMA generate; then
  echo "[studio] WARNING: prisma generate failed — the client in node_modules may" >&2
  echo "[studio] not match prisma/schema.prisma, which breaks every insert." >&2
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

# Switch SQLite to WAL so a sync's writes no longer block the doctor's reads.
# In the default rollback-journal mode one writer locks the whole file, and a
# worklist sync that touches hundreds of rows makes every concurrent query wait
# behind it — measured as P1008 socket timeouts and pages that time out. WAL is
# persistent (it is recorded in the file header, so it survives a restart and
# needs setting once), it is safe to re-apply every boot, and it is a no-op if
# the database already uses it. Never fatal: a helper must not take the clinic
# down, and the studio works in the old mode, just slower.
if [ -f /app/scripts/usg-enable-wal.mjs ]; then
  echo "[studio] SQLite journal mode check (WAL)…"
  node /app/scripts/usg-enable-wal.mjs || echo "[studio] WAL check did not run — continuing" >&2
fi

echo "[studio] Starting server on :3000"
exec "$@"

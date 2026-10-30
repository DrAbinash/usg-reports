#!/usr/bin/env node
/**
 * Put the studio database into WAL journal mode — idempotent, and stored in the
 * database file itself, so it runs once and is a no-op afterwards.
 *
 * Why this exists. A SQLite database in the default rollback-journal mode lets
 * ONE writer block every reader. Measured on the clinic NAS 2026-10-30: a
 * worklist sync writing a few hundred orders made unrelated requests wait on it
 * until Prisma gave up with `P1008 · Socket timeout (the database failed to
 * respond to a query within the configured timeout)` — including the sync's own
 * later writes, and the lock screen's boot call. "The studio is unreachable" was
 * this: the app was healthy, it simply could not read the database while the
 * sync was writing it.
 *
 * WAL lets readers keep working against the last committed snapshot while a
 * writer works, so a busy sync no longer stalls everything beside it.
 *
 * Two facts worth knowing before changing anything else:
 *  - `-wal` / `-shm` sidecar files appear next to studio.db. The studio's own
 *    backups read through Prisma (a consistent snapshot), so they are unaffected;
 *    but a raw `cp studio.db` no longer guarantees the newest committed rows, so
 *    copy the folder or use the app's backup.
 *  - SQLite's WAL does not work over a network filesystem. `data/db` is a bind
 *    mount of the NAS's own volume, which is fine — moving it to an NFS/SMB
 *    mount would not be.
 *
 * Nothing else is tuned: no synchronous level, no autocheckpoint, no busy
 * timeout. One pragma, because that is the property that was missing.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** `PRAGMA journal_mode` answers a one-row, one-column result. */
async function journalMode() {
  try {
    const rows = await db.$queryRawUnsafe("PRAGMA journal_mode");
    const row = Array.isArray(rows) ? rows[0] : rows;
    const value = row ? Object.values(row)[0] : undefined;
    return String(value ?? "unknown").toLowerCase();
  } catch (e) {
    return `unreadable (${firstLine(e)})`;
  }
}

/**
 * Prisma wraps every raw failure in blank lines, so the reason is never the
 * first one — and an empty warning in a startup log is worse than no script.
 */
function firstLine(e) {
  const text = e instanceof Error ? e.message : String(e);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /Raw query|P\d{4}|unable|locked|busy|malformed/i.test(l)) ?? lines.at(-1) ?? text).slice(0, 200);
}

try {
  const before = await journalMode();
  // `$executeRawUnsafe` cannot do this: `PRAGMA journal_mode=WAL` answers with
  // the resulting mode, and Prisma's SQLite driver refuses any "execute" that
  // returns rows ("Execute returned results, which is not allowed in SQLite").
  await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  const after = await journalMode();
  if (after !== "wal") {
    console.log(`[wal] journal_mode ${before} -> ${after}`);
    console.warn("[wal] WARNING: still not in WAL mode — a single writer will keep blocking readers.");
    console.warn("[wal] Check that data/db is on the NAS's own volume, not a network mount.");
  } else if (before === "wal") {
    console.log("[wal] journal_mode already wal — nothing to change (readers do not block behind the writer)");
  } else {
    console.log(`[wal] journal_mode ${before} -> wal (readers no longer block behind the writer)`);
  }
} catch (e) {
  // Never stop the clinic for a pragma: the server starts regardless, and the
  // warning is the signal.
  console.warn(`[wal] could not set WAL mode: ${firstLine(e)}`);
} finally {
  await db.$disconnect();
}

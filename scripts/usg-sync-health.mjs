#!/usr/bin/env node
/**
 * Read-only health probe for the studio's database and worklist sync.
 *
 *   docker exec -w /app usg-reporting-studio node scripts/usg-sync-health.mjs
 *
 * It performs NO writes — every query is a count or a single-row read — so it
 * is safe to run while the clinic is reporting. It prints only sizes, counts,
 * timings and the sync watermark, never a patient name, so its output can be
 * pasted into a bug report.
 *
 * Why the image rather than the host's git folder: what runs is the built
 * image, and a rebuilt image can still carry a generated Prisma client that
 * lags its own schema (that failure rejected every bill-desk write for four
 * days while reads and login kept working). The checks below read the running
 * container's own client and database, so they say what is true right now.
 */
import { statSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MIN = 60_000;
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

/** Sizes of the SQLite file and its write-ahead log, if present. */
function fileSize(p) {
  try {
    return statSync(p).size;
  } catch {
    return null;
  }
}

/**
 * Prisma resolves a relative `file:` URL against the schema folder, not the
 * working directory, so a developer run must look in both places before it is
 * allowed to claim the database is missing.
 */
function locateDb(raw) {
  const candidates = raw.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(raw) ? [raw] : [raw, `prisma/${raw}`];
  for (const c of candidates) if (fileSize(c) !== null) return c;
  return raw;
}

/** Time one query, returning both the duration and any error text. */
async function timed(label, fn) {
  const t0 = performance.now();
  try {
    const value = await fn();
    return { label, ms: Math.round(performance.now() - t0), value, error: null };
  } catch (e) {
    return { label, ms: Math.round(performance.now() - t0), value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The first line of a Prisma error is blank; the reason is at the end. */
function reason(err) {
  if (!err) return "";
  const lines = String(err).split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /P\d{4}|does not exist|Unknown argument|unable|locked|busy/i.test(l)) ?? lines.at(-1) ?? "").slice(0, 160);
}

const DB_PATH = locateDb((process.env.DATABASE_URL ?? "file:/app/data/db/studio.db").replace(/^file:/, "").split("?")[0]);

console.log("=== CARE USG Studio — read-only health probe ===");
console.log(`db file      ${DB_PATH}`);
const main = fileSize(DB_PATH);
const wal = fileSize(`${DB_PATH}-wal`);
const shm = fileSize(`${DB_PATH}-shm`);
if (main === null) console.log("size         COULD NOT READ — wrong path or the file is not here");
else console.log(`size         db=${kb(main)} wal=${wal === null ? "none" : kb(wal)} shm=${shm === null ? "none" : kb(shm)}`);
console.log(`             (a -wal in the tens of MB means checkpoints are not completing: reads queue behind it)`);

console.log("\n--- storage layer: how fast is the disk at all? ---");
// The very first query opens the pool, so it measures Prisma starting up rather
// than the disk. Warm it up untimed, then measure three real round trips.
try {
  await db.$queryRaw`SELECT 1 AS one`;
} catch (e) {
  console.log(`  cannot open the database — ${reason(e instanceof Error ? e.message : String(e))}`);
  console.log("  every number below will read as UNREADABLE until the volume is mounted correctly.\n");
}
const raw1 = await timed("SELECT 1 #1", () => db.$queryRaw`SELECT 1 AS one`);
const raw2 = await timed("SELECT 1 #2", () => db.$queryRaw`SELECT 1 AS one`);
const raw3 = await timed("SELECT 1 #3", () => db.$queryRaw`SELECT 1 AS one`);
for (const r of [raw1, raw2, raw3]) console.log(`${r.label.padEnd(14)} ${r.ms}ms${r.error ? `  ERROR ${reason(r.error)}` : ""}`);
// Median, because one 100ms pause under a competing writer is normal — it is a
// sustained cost that means the volume is the bottleneck.
const rawMs = [raw1.ms, raw2.ms, raw3.ms].sort((a, b) => a - b)[1];

console.log("\n--- the settings row: read on almost every request ---");
const settings = await timed("settings", () =>
  db.hospitalSettings.findFirst({
    select: {
      loginBgUrl: true,
      logoUrl: true,
      usgSignatureUrl: true,
      careApiBase: true,
      orthancUrl: true,
      ohifMode: true,
      usgAutoBackup: true,
    },
  }),
);
if (settings.error) console.log(`settings       ${settings.ms}ms  ERROR ${reason(settings.error)}`);
else {
  const s = settings.value ?? {};
  const inline = (v) => (v ? kb(v.length) : "empty");
  console.log(`settings       ${settings.ms}ms`);
  console.log(`  login background ${inline(s.loginBgUrl)} | logo ${inline(s.logoUrl)} | signature ${inline(s.usgSignatureUrl)}`);
  console.log(`  careApiBase=${s.careApiBase ?? "(unset)"} orthancUrl=${s.orthancUrl ?? "(unset)"} ohifMode=${s.ohifMode ?? "(unset)"} nightlyBackup=${s.usgAutoBackup}`);
  console.log(`  (the login background is stored inline and re-sent to every unauthenticated page load)`);
}

console.log("\n--- is the deployed schema what the deployed code expects? ---");
// Each of these fails loudly if the image's generated client knows a column the
// database never got — which is how a rebuild without a schema push looks.
const cols = [
  ["UsgReport.printSettingsJson (frozen print settings)", () => db.usgReport.findFirst({ select: { id: true, printSettingsJson: true } })],
  ["UsgReport.shareRevokedAt (share withdrawal)", () => db.usgReport.findFirst({ select: { id: true, shareRevokedAt: true } })],
  ["UsgCareOrder.careWorklistId (bill-desk identity)", () => db.usgCareOrder.findFirst({ select: { id: true, careWorklistId: true } })],
  ["UsgSyncState (sync cursor, added with the flood fix)", () => db.usgSyncState.findFirst({ select: { id: true, lastSyncAt: true } })],
];
for (const [label, fn] of cols) {
  const r = await timed(label, fn);
  console.log(`${r.value === null && r.error ? "MISSING" : "ok"}      ${label}${r.error ? ` — ${reason(r.error)}` : ` (${r.ms}ms)`}`);
}

console.log("\n--- sync state: when did worklist rows last arrive? ---");
const sync = await timed("syncState", () => db.usgSyncState.findFirst({ orderBy: { updatedAt: "desc" } }));
if (sync.error) {
  // Two different absences, and only one of them is a deployment fault.
  console.log(`  UsgSyncState unreadable — ${reason(sync.error)}`);
} else if (!sync.value) {
  console.log("  no sync row yet: the studio has never completed a CARE pull on this database.");
} else {
  const st = sync.value;
  const age = (d) => (d ? `${Math.round((Date.now() - new Date(d).getTime()) / MIN)} min ago` : "never");
  console.log(`  lastSyncAt      ${age(st.lastSyncAt)}`);
  console.log(`  lastDeepPullAt  ${age(st.lastDeepPullAt ?? null)}`);
  console.log(`  lastCareOk=${st.lastCareOk} lastOrthancOk=${st.lastOrthancOk} cursorHoldCount=${st.cursorHoldCount}`);
  if (st.lastError) console.log(`  lastError       ${String(st.lastError).slice(0, 160)}`);
  if (st.lastSyncAt && Date.now() - new Date(st.lastSyncAt).getTime() > 30 * MIN) {
    console.log("  WARN: nothing has synced for over 30 minutes.");
  }
}

console.log("\n--- the worklist: real bill-desk rows against fallback rows ---");
// Wrapped because a diagnostic that dies halfway hides the reason it died —
// which is precisely how the stale-client outage stayed invisible for days.
const count = async (label, fn) => {
  try {
    return `${label}=${await fn()}`;
  } catch (e) {
    return `${label}=UNREADABLE (${reason(e instanceof Error ? e.message : String(e))})`;
  }
};
const total = await count("orders_total", () => db.usgCareOrder.count());
const fallback = await count("fallback", () => db.usgCareOrder.count({ where: { careWorklistId: null, billNumber: "" } }));
const lastDay = await count("last_24h", () => db.usgCareOrder.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * MIN) } } }));
console.log(`  ${total} | ${fallback} (never sent by CARE) | ${lastDay}`);
const fallbackRows = Number(/^fallback=(\d+)$/.exec(fallback)?.[1] ?? NaN);
const newest = await timed("newest", () => db.usgCareOrder.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }));
if (newest.error) console.log(`  newest order     UNREADABLE — ${reason(newest.error)}`);
else console.log(`  newest order     ${newest.value?.createdAt ? new Date(newest.value.createdAt).toISOString() : "NONE (fine on a fresh install, fatal mid-session — the sync is not writing)"}`);
if (fallbackRows > 200) console.log(`  WARN: ${fallbackRows} fallback rows — the Orthanc flood is still on the list.`);

console.log("\n--- reports ---");
console.log(
  `  ${await count("reports_total", () => db.usgReport.count())} | ` +
    await count("drafts", () => db.usgReport.count({ where: { status: "DRAFT" } })) +
    ` | ${await count("finalized_last_24h", () => db.usgReport.count({ where: { status: "FINALIZED", updatedAt: { gte: new Date(Date.now() - 24 * 60 * MIN) } } }))}`,
);

console.log("\n--- why the writes fail: the last sync audit entries ---");
// The sync route stores its per-row rejection reasons in the audit trail
// (`worklist.sync` / `worklist.careSync`), e.g. "WL 4213: write rejected
// (Unique constraint failed on accessionNumber)". Read createdAt/action/detail
// only — the audit row also carries patientName, which has no business in a
// console log someone is about to paste into a bug report.
const auditRow = await timed("audit", () =>
  db.usgAudit.findMany({
    where: { action: { in: ["worklist.sync", "worklist.careSync"] } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { createdAt: true, action: true, detail: true },
  }),
);
if (auditRow.error) console.log(`  unreadable — ${reason(auditRow.error)}`);
else if (!auditRow.value?.length) console.log("  no sync audit rows: the sync has never completed a cycle on this database.");
else {
  for (const a of auditRow.value) {
    const when = new Date(a.createdAt).toISOString();
    const text = (a.detail ?? "").replace(/\s+/g, " ").slice(0, 300);
    console.log(`  ${when}  ${a.action}`);
    console.log(`      ${text || "(no detail)"}`);
  }
  console.log("  (detail is truncated here and holds at most five reasons in the stored row)");
}

console.log("\n--- what this means ---");
const verdicts = [];
if (main === null) verdicts.push("the database file could not be read — check the DATABASE_URL/volume mount");
if (rawMs > 30) verdicts.push(`SELECT 1 medians ${rawMs}ms — the storage itself is slow or contended; this is not application code`);
if (wal && wal > 8 * 1024 * 1024) verdicts.push(`the -wal is ${kb(wal)} — checkpoint starvation makes every reader wait`);
if (settings.error) verdicts.push(`the settings row cannot be read: ${reason(settings.error)}`);
verdicts.push("any line above marked MISSING means the running image and the database disagree — restart the container so the entrypoint regenerates the client and pushes the schema, and re-run this probe");
if (Number.isFinite(fallbackRows) && fallbackRows > 200) verdicts.push("the fallback flood is still present — run the prune with --dry-run before touching it");
for (const v of verdicts) console.log(`  * ${v}`);

console.log(`\ntotal ${Math.round(performance.now())}ms since process start`);
await db.$disconnect();

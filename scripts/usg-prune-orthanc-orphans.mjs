#!/usr/bin/env node
/**
 * Remove the LEGACY Orthanc-only worklist rows that older syncs left behind.
 *
 *   docker exec -w /app usg-reporting-studio node scripts/usg-prune-orthanc-orphans.mjs
 *   docker exec -w /app usg-reporting-studio node scripts/usg-prune-orthanc-orphans.mjs --execute
 *
 * An "orphan" here is a UsgCareOrder that CARE never sent: no careWorklistId,
 * no bill number. Older builds wrote one of these for every ultrasound study in
 * the PACS, and on this clinic 1,218 of 2,301 worklist rows ended up as such
 * copies. They carry no referring doctor and no catalogued test name, so the
 * list read "Self/Walk-in · USG Study" for everyone and the bill-desk rows
 * underneath became impossible to find.
 *
 * SINCE v6.22 the sync no longer creates them: an un-billed scan stays a scan in
 * the live PACS queue and only enters the order table when the doctor drafts it.
 * So this script's subject matter is historical, and running it is optional
 * tidying, not a fix — the count can no longer grow.
 *
 * Deleted, and ONLY ever these:
 *   - never sent from CARE (careWorklistId NULL and billNumber ''), and
 *   - nothing was written against them (no report, no Form F, still PENDING), and
 *   - either the patient already has a CARE row on that scanning day, or the
 *     study is older than the window below.
 *
 * A CARE row is never touched, and a row carrying a report is never touched —
 * that is the difference between pruning noise and deleting a clinical record.
 * DICOM images are not stored here: Orthanc keeps every study regardless.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const execute = process.argv.includes("--execute");

/** Rows scanned before this many days back are treated as archive, not worklist. */
const ORPHAN_MAX_AGE_DAYS = 3;
/** Care stores a study day at noon or midnight UTC; the scanner's own day is IST. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function istDay(d) {
  if (!d) return null;
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Sorted name tokens, so CARE's "First Last" and DICOM's "LAST FIRST" agree. */
function nameDayKey(name, ymd) {
  const d = (ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const tokens = (name ?? "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort();
  if (!tokens.length) return null;
  return `${tokens.join(" ")}|${d}`;
}

function oldestAcceptedYmd() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() - ORPHAN_MAX_AGE_DAYS);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const orders = await db.usgCareOrder.findMany({
    select: {
      id: true,
      clinicId: true,
      patientName: true,
      studyDate: true,
      careWorklistId: true,
      billNumber: true,
      reportId: true,
      formFId: true,
      status: true,
    },
  });

  const billedKeys = new Set(
    orders
      .filter((o) => o.careWorklistId)
      .map((o) => `${o.clinicId}|${nameDayKey(o.patientName, istDay(o.studyDate)) ?? ""}`)
      .filter((k) => !k.endsWith("|")),
  );

  const oldest = oldestAcceptedYmd();
  const doomed = { duplicateOfBilledRow: [], tooOld: [] };

  for (const o of orders) {
    if (o.careWorklistId || (o.billNumber ?? "").trim()) continue;
    if (o.reportId || o.formFId || o.status !== "PENDING") continue;
    const day = istDay(o.studyDate);
    const key = `${o.clinicId}|${nameDayKey(o.patientName, day) ?? ""}`;
    if (billedKeys.has(key)) {
      doomed.duplicateOfBilledRow.push(o.id);
    } else if (day && day < oldest) {
      doomed.tooOld.push(o.id);
    }
  }

  const total = doomed.duplicateOfBilledRow.length + doomed.tooOld.length;
  console.log(
    `[orphans] rows=${orders.length} candidates=${total} ` +
      `duplicateOfBilledRow=${doomed.duplicateOfBilledRow.length} tooOld=${doomed.tooOld.length} ` +
      `(older than ${oldest}, CARE rows untouched, rows with a report untouched)`,
  );
  if (total === 0) {
    console.log("[orphans] nothing to prune");
    return;
  }
  if (!execute) {
    console.log("[orphans] dry run — pass --execute to delete");
    return;
  }

  const ids = [...doomed.duplicateOfBilledRow, ...doomed.tooOld];
  const before = await db.usgCareOrder.count({ where: { careWorklistId: null, billNumber: "" } });
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const gone = await db.usgCareOrder.deleteMany({
      // Re-state every guard in the WHERE clause: a row that gained a report
      // between the scan above and this delete is not ours to delete.
      where: {
        id: { in: slice },
        careWorklistId: null,
        billNumber: "",
        reportId: null,
        formFId: null,
        status: "PENDING",
      },
    });
    deleted += gone.count;
  }
  const after = await db.usgCareOrder.count({ where: { careWorklistId: null, billNumber: "" } });

  await db.usgAudit.create({
    data: {
      clinicId: "default",
      action: "worklist.orphans_pruned",
      detail: `candidates=${total} deleted=${deleted} fallbackRowsBefore=${before} fallbackRowsAfter=${after}`,
    },
  });

  console.log(`[orphans] deleted ${deleted} of ${total} candidates (${before} → ${after} fallback rows)`);
}

main()
  .catch((e) => console.warn(`[orphans] skipped (${e instanceof Error ? e.message : String(e)}) — nothing deleted`))
  .finally(() => db.$disconnect());

#!/usr/bin/env node
/**
 * v6.1 worklist-identity migration helper — run by docker-entrypoint.sh AFTER
 * `prisma db push` (the column must already be nullable).
 *
 * What it does (idempotent, non-destructive, USG data never touched):
 *   1. UsgCareOrder.accessionNumber "" → NULL
 *      The v6 schema had accessionNumber NOT NULL + UNIQUE, so a legacy row
 *      could only hold "" via a backup-restore edge. NULL is the canonical
 *      "the ERP never supplied one" value (SQLite UNIQUE treats NULLs as
 *      distinct, so any number of blank-accession orders now coexist).
 *   2. Diagnostics only (no writes): counts duplicate careWorklistId /
 *      studyInstanceUid values if any exist, so the operator sees them in
 *      the container log — resolution stays deterministic oldest-first.
 *
 * Never exits non-zero: a migration helper must not take the clinic down.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const blanks = await db.usgCareOrder.updateMany({
    where: { accessionNumber: "" },
    data: { accessionNumber: null },
  });
  if (blanks.count > 0) {
    console.log(`[v7] normalised ${blanks.count} blank accessionNumber row(s) to NULL`);
  }

  // Diagnostics — report, never repair.
  const wlIds = await db.usgCareOrder.groupBy({
    by: ["careWorklistId"],
    where: { careWorklistId: { not: null } },
    _count: { _all: true },
    having: { careWorklistId: { _count: { gt: 1 } } },
  });
  if (wlIds.length > 0) {
    console.warn(`[v7] NOTE: ${wlIds.length} duplicated careWorklistId value(s) — sync resolves oldest-first; review manually`);
  }
  const uids = await db.usgCareOrder.groupBy({
    by: ["studyInstanceUid"],
    where: { studyInstanceUid: { not: null } },
    _count: { _all: true },
    having: { studyInstanceUid: { _count: { gt: 1 } } },
  });
  if (uids.length > 0) {
    console.warn(`[v7] NOTE: ${uids.length} duplicated studyInstanceUid value(s) — these orders share an imaging study; they stay separate rows`);
  }
  console.log("[v7] worklist-identity check complete");
}

main()
  .catch((e) => console.warn(`[v7] skipped (${e instanceof Error ? e.message : String(e)}) — continuing`))
  .finally(() => db.$disconnect());

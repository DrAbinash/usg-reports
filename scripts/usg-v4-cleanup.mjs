#!/usr/bin/env node
/**
 * CARE USG Studio v4 — USG-only cleanup (idempotent, one-time in effect).
 *
 * v1–v3 of this repo shipped the shared mri-reports codebase, so the
 * database also carried the radiology worklist/reporting structures.
 * v4 removed them from the app; this script removes them from the
 * database so `prisma db push` never has to make a destructive change
 * (the entrypoint refuses --accept-data-loss on purpose).
 *
 * Removed, if present:
 *   - tables: CareOrderLink, Report, ReportImage, FindingRow,
 *             QuickPhrase, TechniqueTemplate, ReportFormat, SyncState
 *   - columns on HospitalSettings: radiologist*, careApi*, orthanc*,
 *             ohif* (MRI/PACS/OHIF integration fields)
 *
 * NEVER touched: UsgReport, UsgPathology, Session and every surviving
 * HospitalSettings column. Safe to run on every boot — on a clean or
 * already-migrated database it is a fast no-op.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const LEGACY_TABLES = [
  "CareOrderLink",
  "Report",
  "ReportImage",
  "FindingRow",
  "QuickPhrase",
  "TechniqueTemplate",
  "ReportFormat",
  "SyncState",
];

const LEGACY_SETTINGS_COLUMNS = [
  "radiologistName",
  "radiologistQual",
  "radiologistRegNo",
  "careApiBase",
  "careApiKey",
  "orthancUrl",
  "orthancUsername",
  "orthancPassword",
  "ohifLanUrl",
  "ohifTailscaleUrl",
];

function databaseFile() {
  const url = process.env.DATABASE_URL ?? "";
  const m = /^file:(.+?)(\?.*)?$/.exec(url.trim());
  if (!m) return null;
  const p = m[1];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

async function main() {
  const file = databaseFile();
  if (!file || !fs.existsSync(file)) {
    console.log("[v4-cleanup] no database file yet — nothing to clean");
    return;
  }

  const prisma = new PrismaClient({ log: ["error"] });
  try {
    let removed = 0;

    // 1) Legacy radiology tables (empty or not — their data belonged to the
    //    mri-reports deployment, never to this USG-only studio).
    for (const t of LEGACY_TABLES) {
      const exists = await prisma.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        t,
      );
      if (exists.length > 0) {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}"`);
        removed++;
        console.log(`[v4-cleanup] dropped legacy table ${t}`);
      }
    }

    // 2) Legacy MRI/PACS columns on HospitalSettings (conditional —
    //    re-running on a migrated database must stay a no-op).
    const settingsExists = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'HospitalSettings'`,
    );
    if (settingsExists.length > 0) {
      const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("HospitalSettings")`);
      const names = new Set(cols.map((c) => String(c.name)));
      for (const c of LEGACY_SETTINGS_COLUMNS) {
        if (names.has(c)) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "HospitalSettings" DROP COLUMN "${c}"`);
          removed++;
          console.log(`[v4-cleanup] dropped legacy column HospitalSettings.${c}`);
        }
      }
    }

    console.log(removed === 0 ? "[v4-cleanup] already clean — nothing to do" : `[v4-cleanup] done (${removed} structure(s) removed)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`[v4-cleanup] FAILED: ${e?.message ?? e}`);
  // Non-fatal to the caller: the entrypoint's `prisma db push` (no
  // --accept-data-loss) remains the real gate — if this script could not
  // clean, db push will stop startup loudly instead of silently destroying
  // anything.
  process.exit(1);
});

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
 *   - columns on HospitalSettings named in LEGACY_SETTINGS_COLUMNS below
 *
 * NEVER touched: UsgReport, UsgPathology, Session, every surviving
 * HospitalSettings column, and the OHIF viewer fields
 * (ohifMode/ohifLanUrl/ohifTailscaleUrl/ohifCustomUrl) — those are live
 * app settings, so dropping them here would wipe the doctor's saved viewer
 * endpoints on every container restart. Safe to run on every boot — on a
 * clean or already-migrated database it is a fast no-op.
 *
 * LEGACY_SETTINGS_COLUMNS is a claim about the past, not the authority: the
 * schema is. Any name `prisma/schema.prisma` still declares is live and is
 * skipped, because dropping it would destroy real configuration and `db push`
 * would then silently recreate it empty. That is exactly what happened here —
 * v4 listed the careApi and orthanc fields as dead, v6 brought them back, and
 * every boot wiped the clinic's saved ERP + Orthanc credentials.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

export const LEGACY_SETTINGS_COLUMNS = [
  "radiologistName",
  "radiologistQual",
  "radiologistRegNo",
  "careApiBase",
  "careApiKey",
  "orthancUrl",
  "orthancUsername",
  "orthancPassword",
  // OHIF viewer fields are deliberately NOT listed: they are live USG Studio
  // settings (Settings → Integrations → OHIF Viewer) read by
  // src/lib/usg/ohifResolver.ts. Dropping them here would delete the doctor's
  // saved endpoints at boot and re-add them blank on the next `db push`.
];

/**
 * Column names the current Prisma schema declares on HospitalSettings.
 *
 * Read from the schema file rather than the live database: the whole point is
 * to know what the app still needs, and `db push` runs right after this script,
 * so the DB will match the schema a moment later either way.
 *
 * Returns null when the schema cannot be read — callers must then drop nothing.
 */
export function schemaSettingsColumns(schemaPath) {
  let src;
  try {
    src = fs.readFileSync(schemaPath, "utf8");
  } catch {
    return null;
  }
  const block = /\bmodel\s+HospitalSettings\s*\{([\s\S]*?)\n\}/.exec(src);
  if (!block) return null;
  const fields = new Set();
  for (const raw of block[1].split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    const field = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line);
    if (field) fields.add(field[0]);
  }
  return fields.size > 0 ? fields : null;
}

/**
 * Legacy names that are safe to drop right now — i.e. not declared by the
 * schema. Exported for tests.
 */
export function droppableSettingsColumns(live) {
  if (!live) return [];
  return LEGACY_SETTINGS_COLUMNS.filter((c) => !live.has(c));
}

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

    // 2) Legacy columns on HospitalSettings (conditional — re-running on a
    //    migrated database must stay a no-op, and a column the schema still
    //    declares must survive even if it appears in the legacy list).
    const schemaPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../prisma/schema.prisma",
    );
    const live = schemaSettingsColumns(schemaPath);
    if (!live) {
      console.warn(
        `[v4-cleanup] WARNING: could not read HospitalSettings from ${schemaPath} — ` +
          `skipping every column drop. Legacy tables above were still cleaned.`,
      );
    } else {
      const settingsExists = await prisma.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'HospitalSettings'`,
      );
      if (settingsExists.length > 0) {
        const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("HospitalSettings")`);
        const names = new Set(cols.map((c) => String(c.name)));
        for (const c of droppableSettingsColumns(live)) {
          if (names.has(c)) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "HospitalSettings" DROP COLUMN "${c}"`);
            removed++;
            console.log(`[v4-cleanup] dropped legacy column HospitalSettings.${c}`);
          }
        }
        const kept = LEGACY_SETTINGS_COLUMNS.filter((c) => live.has(c) && names.has(c));
        if (kept.length) {
          console.log(
            `[v4-cleanup] preserving HospitalSettings.${kept.join(", ")} — ` +
              `declared by the schema, so live configuration rather than legacy structure`,
          );
        }
      }
    }

    console.log(removed === 0 ? "[v4-cleanup] already clean — nothing to do" : `[v4-cleanup] done (${removed} structure(s) removed)`);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when executed directly — tests import the pure helpers above.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`[v4-cleanup] FAILED: ${e?.message ?? e}`);
    // Non-fatal to the caller: the entrypoint's `prisma db push` (no
    // --accept-data-loss) remains the real gate — if this script could not
    // clean, db push will stop startup loudly instead of silently destroying
    // anything.
    process.exit(1);
  });
}


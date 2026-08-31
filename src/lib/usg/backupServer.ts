/**
 * USG Studio — server-side full-clinic backup collection, restore and the
 * nightly rotation (v5 phase 6).
 *
 * One JSON file carries the whole clinic: settings, custom findings,
 * patients, every report (state + frozen snapshots) and their stills.
 * Restore is disaster recovery: upserts by id, idempotent, never deletes
 * rows that are NOT in the file.
 *
 * Nightly rotation: when Settings → Data enables "Automatic nightly backup",
 * instrumentation.ts calls `runNightlyBackupIfDue()` every 10 minutes; after
 * 02:00 local it writes data/backups/usg-auto-YYYY-MM-DD.json once per day
 * and keeps the newest 14.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  buildBackup, parseBackup, parseFullBackup,
  type UsgBackupFile, type UsgFullBackupFile,
} from "./backup";

/** Backup directory — overridable (tests point it at a scratch dir). */
function backupDir(): string {
  return process.env.USG_BACKUP_DIR ?? path.join(process.cwd(), "data", "backups");
}
const NIGHTLY_PREFIX = "usg-auto-";
const NIGHTLY_KEEP = 14;

/** Collect the full-clinic backup payload (used by the API + the nightly job). */
export async function collectFullBackup(): Promise<UsgFullBackupFile> {
  const settings = await getSettings();
  const customs = await db.usgPathology.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const normalOverrideRows = await db.usgNormalOverride.findMany().catch(() => []);
  const normalOverrides = normalOverrideRows.map((r) => ({ studyKey: r.studyKey, organKey: r.organKey, text: r.text }));
  const patients = await db.usgPatient.findMany();
  const reports = await db.usgReport.findMany({ orderBy: { createdAt: "asc" } });
  const images = await db.usgReportImage.findMany({ orderBy: { sortOrder: "asc" } });

  const base = buildBackup(
    settings as unknown as Record<string, unknown>,
    customs.map((r) => ({
      organKey: r.organKey,
      label: r.label,
      findingText: r.findingText,
      impressionLines: safeJsonArray(r.impressionLinesJson),
      titleFragment: r.titleFragment,
      sortOrder: r.sortOrder,
    })),
    normalOverrides,
  );

  return {
    ...base,
    format: "usg-clinic-backup",
    normalOverrides: base.normalOverrides?.length ? base.normalOverrides : normalOverrides,
    patients: patients.map((p) => ({
      id: p.id, name: p.name, phone: p.phone, normName: p.normName, normPhone: p.normPhone, notes: p.notes,
    })),
    reports: reports.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      patientAge: r.patientAge,
      patientSex: r.patientSex,
      referredBy: r.referredBy,
      studyKey: r.studyKey,
      technique: r.technique,
      stateJson: r.stateJson,
      studyTitle: r.studyTitle,
      findings: r.findings,
      impression: r.impression,
      status: r.status,
      reportHtml: r.reportHtml,
      finalizedAt: r.finalizedAt?.toISOString() ?? null,
      serialNo: r.serialNo,
      scanDate: r.scanDate?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      images: images
        .filter((i) => i.reportId === r.id)
        .map((i) => ({ id: i.id, dataUrl: i.dataUrl, caption: i.caption, sortOrder: i.sortOrder })),
    })),
  };
}

export type FullRestoreResult = {
  settingsRestored: number;
  customPathologiesRestored: number;
  patientsRestored: number;
  reportsRestored: number;
  reportsSkipped: number;
  imagesRestored: number;
};

/** Apply a full-clinic backup (idempotent disaster recovery). */
export async function applyFullRestore(raw: unknown): Promise<FullRestoreResult> {
  const backup = parseFullBackup(raw);
  const result: FullRestoreResult = {
    settingsRestored: 0,
    customPathologiesRestored: 0,
    patientsRestored: 0,
    reportsRestored: 0,
    reportsSkipped: 0,
    imagesRestored: 0,
  };

  // Settings + customs — the same whitelist path as personalisation restore.
  const asPersonalisation: UsgBackupFile = {
    ...backup,
    format: "usg-studio-backup",
  };
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(asPersonalisation.settings)) {
    if (typeof v === "string") patch[k] = v;
    else if (typeof v === "boolean") patch[k] = v ? "true" : "false";
  }
  if (Object.keys(patch).length) {
    await updateSettings(patch);
    result.settingsRestored = Object.keys(patch).length;
  }
  for (const n of asPersonalisation.normalOverrides ?? []) {
    await db.usgNormalOverride.upsert({
      where: { studyKey_organKey: { studyKey: n.studyKey, organKey: n.organKey } },
      create: { studyKey: n.studyKey, organKey: n.organKey, text: n.text },
      update: { text: n.text },
    }).catch(() => undefined);
  }

  for (const c of asPersonalisation.customPathologies) {
    await db.usgPathology.upsert({
      where: { organKey_label: { organKey: c.organKey, label: c.label } },
      create: {
        organKey: c.organKey,
        label: c.label,
        findingText: c.findingText,
        impressionLinesJson: JSON.stringify(c.impressionLines),
        titleFragment: c.titleFragment,
        sortOrder: c.sortOrder,
      },
      update: {
        findingText: c.findingText,
        impressionLinesJson: JSON.stringify(c.impressionLines),
        titleFragment: c.titleFragment,
        sortOrder: c.sortOrder,
      },
    });
    result.customPathologiesRestored++;
  }

  // Patients — upsert by id so report links stay intact.
  for (const p of backup.patients) {
    await db.usgPatient.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, phone: p.phone, normName: p.normName, normPhone: p.normPhone, notes: p.notes },
      update: { name: p.name, phone: p.phone, normName: p.normName, normPhone: p.normPhone, notes: p.notes },
    });
    result.patientsRestored++;
  }

  // Reports — upsert by id; a serial clash (DB kept working past the backup
  // date) skips that report rather than corrupting the register.
  for (const r of backup.reports) {
    const data = {
      patientId: r.patientId,
      patientName: r.patientName,
      patientAge: r.patientAge,
      patientSex: r.patientSex,
      referredBy: r.referredBy,
      studyKey: r.studyKey,
      technique: r.technique,
      stateJson: r.stateJson,
      studyTitle: r.studyTitle,
      findings: r.findings,
      impression: r.impression,
      status: r.status,
      reportHtml: r.reportHtml,
      finalizedAt: r.finalizedAt ? new Date(r.finalizedAt) : null,
      serialNo: r.serialNo,
      scanDate: r.scanDate ? new Date(r.scanDate) : null,
      createdAt: new Date(r.createdAt),
    };
    try {
      await db.usgReport.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
      result.reportsRestored++;
    } catch {
      result.reportsSkipped++;
      continue;
    }
    // Images — replace whatever this report currently carries.
    await db.usgReportImage.deleteMany({ where: { reportId: r.id } });
    if (r.images.length) {
      await db.usgReportImage.createMany({
        data: r.images.map((i) => ({ id: i.id, reportId: r.id, dataUrl: i.dataUrl, caption: i.caption, sortOrder: i.sortOrder })),
      });
      result.imagesRestored += r.images.length;
    }
  }

  return result;
}

// ── Nightly rotation ─────────────────────────────────────────────────────

export type BackupStatus = {
  autoBackup: boolean;
  lastNightlyAt: string | null;
  files: { name: string; bytes: number; modifiedAt: string }[];
};

export async function backupsDir(): Promise<string> {
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function backupStatus(): Promise<BackupStatus> {
  const settings = await getSettings();
  let files: BackupStatus["files"] = [];
  let lastNightlyAt: string | null = null;
  try {
    const dir = backupDir();
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
    const stats = await Promise.all(names.map(async (name) => {
      const st = await fs.stat(path.join(dir, name));
      return { name, bytes: st.size, modifiedAt: st.mtime.toISOString() };
    }));
    files = stats.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 20);
    const nightly = stats.find((f) => f.name.startsWith(NIGHTLY_PREFIX));
    if (nightly) lastNightlyAt = nightly.modifiedAt;
  } catch {
    // dir missing — no backups yet
  }
  return { autoBackup: settings.usgAutoBackup, lastNightlyAt, files };
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Called from instrumentation on an interval. Writes the nightly file once
 *  per local day (after 02:00), prunes old ones. Returns the filename or null. */
export async function runNightlyBackupIfDue(now = new Date()): Promise<string | null> {
  try {
    const settings = await getSettings();
    if (!settings.usgAutoBackup) return null;
    if (now.getHours() < 2) return null; // only after 02:00 local

    const day = isoDay(now);
    const name = `${NIGHTLY_PREFIX}${day}.json`;
    const dir = await backupsDir();
    const file = path.join(dir, name);
    try {
      await fs.access(file);
      return null; // already written today
    } catch {
      // not there yet — write it
    }
    const payload = await collectFullBackup();
    await fs.writeFile(file, JSON.stringify(payload), "utf8");

    // Prune: keep the newest NIGHTLY_KEEP usg-auto-*.json files.
    const autos = (await fs.readdir(dir))
      .filter((n) => n.startsWith(NIGHTLY_PREFIX) && n.endsWith(".json"))
      .sort();
    while (autos.length > NIGHTLY_KEEP) {
      const victim = autos.shift();
      if (victim) await fs.rm(path.join(dir, victim), { force: true });
    }
    return name;
  } catch {
    return null; // nightly backup is best-effort
  }
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Re-export for the restore route's personalisation path.
export { parseBackup };

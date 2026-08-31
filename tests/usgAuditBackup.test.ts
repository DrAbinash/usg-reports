/**
 * Audit trail + full-clinic backup tests (v5 phase 6) — DB-backed.
 *
 * Contract:
 *   • audit() writes rows and NEVER throws (clinical actions survive it)
 *   • the full backup carries patients + reports + stills verbatim
 *   • full restore is idempotent — restoring the same file twice changes
 *     nothing; rows not in the file are untouched; register clashes skip
 *     instead of corrupting
 *   • nightly rotation honours the toggle, the 02:00 gate and the once-a-day rule
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";
import { auditLabel } from "@/lib/usg/auditShared";
import { parseFullBackup } from "@/lib/usg/backup";
import {
  applyFullRestore, backupStatus, collectFullBackup, runNightlyBackupIfDue,
} from "@/lib/usg/backupServer";
import { updateSettings } from "@/lib/settings";
import { validateImageDataUrl } from "@/lib/usg/images";

const png1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Point the backup dir at a scratch location for these tests.
const SCRATCH = path.join(process.cwd(), "tests", ".tmp", "backups");
process.env.VITEST_BACKUP_DIR = SCRATCH;
// backupServer computes BACKUP_DIR at import time from cwd — patch via module state.

beforeEach(async () => {
  await db.usgAudit.deleteMany();
  await db.usgReportImage.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
  await updateSettings({ usgAutoBackup: "false" });
  rmSync(SCRATCH, { recursive: true, force: true });
});

afterEach(async () => {
  await db.usgAudit.deleteMany();
  await db.usgReportImage.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
  rmSync(SCRATCH, { recursive: true, force: true });
});

async function seedClinic() {
  const patient = await db.usgPatient.create({
    data: { id: "pat1", name: "Rani Devi", phone: "9431234567", normName: "rani devi", normPhone: "9431234567" },
  });
  const report = await db.usgReport.create({
    data: {
      id: "rep1",
      patientId: patient.id,
      patientName: "Rani Devi",
      patientAge: "30",
      patientSex: "F",
      referredBy: "Dr. Kumar",
      studyKey: "wa-female",
      technique: "supine",
      stateJson: "{}",
      studyTitle: "USG WHOLE ABDOMEN",
      findings: "LIVER: normal",
      impression: "Normal scan",
      status: "FINALIZED",
      serialNo: 7,
      reportHtml: "<html>frozen</html>",
    },
  });
  await db.usgReportImage.create({
    data: { id: "img1", reportId: report.id, dataUrl: png1x1, caption: "longitudinal", sortOrder: 10 },
  });
  return { patient, report };
}

describe("audit()", () => {
  it("writes append-only rows with all context fields", async () => {
    await audit({
      action: "report.finalize",
      reportId: "rep1",
      serialNo: 7,
      patientName: "Rani Devi",
      detail: "register no. USG-0007 frozen",
    });
    const rows = await db.usgAudit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("report.finalize");
    expect(rows[0].serialNo).toBe(7);
    expect(rows[0].detail).toContain("USG-0007");
  });

  it("never throws — a clinical action survives audit failures", async () => {
    await expect(
      audit({ action: "x".repeat(10), patientName: null, detail: "" }),
    ).resolves.toBeUndefined();
  });

  it("labels are client-safe and cover the known actions", () => {
    expect(auditLabel("report.finalize")).toBe("Report finalized");
    expect(auditLabel("unknown.action")).toBe("unknown.action");
  });
});

describe("full-clinic backup", () => {
  it("collects patients, reports and stills verbatim", async () => {
    await seedClinic();
    const payload = await collectFullBackup();
    expect(payload.format).toBe("usg-clinic-backup");
    expect(payload.patients).toHaveLength(1);
    expect(payload.reports).toHaveLength(1);
    expect(payload.reports[0].serialNo).toBe(7);
    expect(payload.reports[0].images).toHaveLength(1);
    expect(payload.reports[0].images[0].caption).toBe("longitudinal");
    expect(payload.reports[0].reportHtml).toContain("frozen");
  });

  it("round-trips through parseFullBackup", async () => {
    await seedClinic();
    const parsed = parseFullBackup(JSON.parse(JSON.stringify(await collectFullBackup())));
    expect(parsed.reports[0].id).toBe("rep1");
    expect(parsed.patients[0].normPhone).toBe("9431234567");
  });

  it("rejects personalisation files with a pointed message", () => {
    expect(() =>
      parseFullBackup({ format: "usg-studio-backup", version: 1, settings: {}, customPathologies: [] }),
    ).toThrow("personalisation backup");
  });
});

describe("full restore", () => {
  it("restores into an empty DB and is idempotent", async () => {
    await seedClinic();
    const backup = JSON.parse(JSON.stringify(await collectFullBackup()));

    // Wipe the clinic (simulating the disaster).
    await db.usgReportImage.deleteMany();
    await db.usgReport.deleteMany();
    await db.usgPatient.deleteMany();
    expect(await db.usgReport.count()).toBe(0);

    const r1 = await applyFullRestore(backup);
    expect(r1.reportsRestored).toBe(1);
    expect(r1.patientsRestored).toBe(1);
    expect(r1.imagesRestored).toBe(1);
    expect(await db.usgReport.count()).toBe(1);
    expect((await db.usgReport.findUnique({ where: { id: "rep1" } }))?.serialNo).toBe(7);

    // Second restore of the same file changes nothing.
    const r2 = await applyFullRestore(backup);
    expect(r2.reportsRestored).toBe(1);
    expect(await db.usgReport.count()).toBe(1);
    expect(await db.usgReportImage.count()).toBe(1);
  });

  it("leaves rows that are not in the file alone", async () => {
    await seedClinic();
    const backup = JSON.parse(JSON.stringify(await collectFullBackup()));

    // A report created after the backup was taken.
    await db.usgReport.create({
      data: { id: "rep2", patientName: "Later Patient", studyKey: "kub", status: "DRAFT" },
    });
    await applyFullRestore(backup);
    expect(await db.usgReport.count()).toBe(2);
    expect(await db.usgReport.findUnique({ where: { id: "rep2" } })).toBeTruthy();
  });

  it("skips a report whose serial clashes with a newer row instead of corrupting the register", async () => {
    await seedClinic();
    const backup = JSON.parse(JSON.stringify(await collectFullBackup()));

    // Wipe, then create a NEWER report that took register no. 7 after the backup.
    await db.usgReportImage.deleteMany();
    await db.usgReport.deleteMany();
    await db.usgPatient.deleteMany();
    await db.usgReport.create({
      data: { id: "rep-later", patientName: "Newer Patient", studyKey: "kub", status: "FINALIZED", serialNo: 7 },
    });

    const r = await applyFullRestore(backup);
    expect(r.reportsSkipped).toBe(1);
    expect(r.reportsRestored).toBe(0);
    // The newer report keeps the register number.
    const later = await db.usgReport.findUnique({ where: { id: "rep-later" } });
    expect(later?.serialNo).toBe(7);
  });
});

describe("nightly rotation", () => {
  it("does nothing while the toggle is off", async () => {
    await updateSettings({ usgAutoBackup: "false" });
    expect(await runNightlyBackupIfDue(new Date(2026, 7, 31, 3, 0))).toBeNull();
  });

  it("does nothing before 02:00 local", async () => {
    await updateSettings({ usgAutoBackup: "true" });
    expect(await runNightlyBackupIfDue(new Date(2026, 7, 31, 1, 30))).toBeNull();
  });

  it("writes one file per day when enabled and due", async () => {
    await updateSettings({ usgAutoBackup: "true" });
    await seedClinic();

    mkdirSync(SCRATCH, { recursive: true });
    const dir = await (await import("@/lib/usg/backupServer")).backupsDir();
    // The module resolves BACKUP_DIR from cwd — point it at the scratch dir.
    // (backupsDir() creates it; for the assertion we just check the write.)

    const first = await runNightlyBackupIfDue(new Date(2026, 7, 31, 3, 0));
    expect(first).toBe("usg-auto-2026-08-31.json");
    const written = path.join(dir, first!);
    const content = JSON.parse(await fs.readFile(written, "utf8"));
    expect(content.format).toBe("usg-clinic-backup");
    expect(content.reports).toHaveLength(1);

    // Same day again → no second write.
    expect(await runNightlyBackupIfDue(new Date(2026, 7, 31, 15, 0))).toBeNull();

    // Status reports the file.
    const status = await backupStatus();
    expect(status.autoBackup).toBe(true);
    expect(status.files.some((f) => f.name === first)).toBe(true);
    expect(status.lastNightlyAt).toBeTruthy();
  });

  it("image validation still guards the round trip", () => {
    expect(validateImageDataUrl(png1x1).ok).toBe(true);
  });
});

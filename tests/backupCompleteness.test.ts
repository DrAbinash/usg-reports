/**
 * What a backup can actually rebuild.
 *
 * The nightly file existed, was even wired to a timer, and silently omitted five
 * tables: the sonologist directory, the signed report templates, the per-report
 * saved wording, the wording overrides, and the critical-communication log — the
 * last being the evidence that a dangerous finding was phoned through, and the
 * audit trail, which is the clinic's memory of who did what. A restore on a new
 * box would have produced a studio that looked healthy and remembered nothing.
 *
 * So this test does the round trip on the real database, and the number it
 * asserts is the only one a doctor cares about: would anything have been lost?
 */
import { beforeEach, expect, test } from "vitest";
import { db } from "@/lib/db";
import { applyFullRestore, collectFullBackup } from "@/lib/usg/backupServer";

const created: string[] = [];

async function seed() {
  const doctor = await db.usgDoctor.create({
    data: {
      clinicId: "default",
      name: "DR TEST SIGNER",
      normName: "dr test signer",
      specialization: "NEUROLOGY",
      degree: "MBBS",
    },
  });
  const template = await db.usgReportTemplate.create({
    data: { clinicId: "default", name: "Round-trip template", studyKey: "wa-male", stateJson: "{}" },
  });
  const wording = await db.usgPathologyWordingOverride.create({
    data: {
      clinicId: "default",
      studyKey: "wa-male",
      organKey: "liver",
      pathologyKey: "fatty-liver",
      kind: "impression",
      text: "Custom wording",
    },
  });
  // The comm log has a real FK to UsgReport (and no clinicId of its own), so the
  // round trip needs a report to hang off.
  const report = await db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      studyKey: "wa-male",
      studyTitle: "USG Whole Abdomen",
      status: "FINALIZED",
    },
  });
  const comm = await db.usgCriticalCommunication.create({
    data: {
      reportId: report.id,
      findingText: "Portal vein thrombosis",
      communicatedTo: "Dr Referrer",
      communicatedAt: new Date("2026-11-01T09:30:00+05:30"),
      method: "phone",
    },
  });
  const auditRow = await db.usgAudit.create({
    data: { clinicId: "default", action: "test.roundtrip", detail: "kept in the backup" },
  });
  const order = await db.usgCareOrder.create({
    data: {
      clinicId: "default",
      accessionNumber: "ACC-ROUNDTRIP",
      patientName: "Sample Patientone",
      modality: "USG",
      status: "PENDING",
      studyInstanceUid: "1.2.826.0.150.roundtrip",
      uidLinkedBy: "name+day, nearest",
    },
  });
  created.push(doctor.id, template.id, wording.id, comm.id, auditRow.id, order.id, report.id);
}

async function wipe() {
  await db.usgCriticalCommunication.deleteMany({ where: { id: { in: created } } });
  await db.usgReport.deleteMany({ where: { id: { in: created } } });
  await db.usgDoctor.deleteMany({ where: { id: { in: created } } });
  await db.usgReportTemplate.deleteMany({ where: { id: { in: created } } });
  await db.usgPathologyWordingOverride.deleteMany({ where: { id: { in: created } } });
  await db.usgAudit.deleteMany({ where: { id: { in: created } } });
  await db.usgCareOrder.deleteMany({ where: { id: { in: created } } });
}

beforeEach(async () => {
  created.length = 0;
  await db.usgSyncState.count().catch(() => 0);
});

test("a full backup carries the five tables it used to drop, and puts them back", async () => {
  await seed();
  const file = await collectFullBackup();
  const raw = JSON.parse(JSON.stringify(file));
  expect(raw.doctors?.length).toBeGreaterThan(0);
  expect(raw.templates?.length).toBeGreaterThan(0);
  expect(raw.wordingOverrides?.length).toBeGreaterThan(0);
  expect(raw.criticalComms?.length).toBeGreaterThan(0);
  expect(raw.auditRows?.length).toBeGreaterThan(0);

  await wipe();
  expect(await db.usgCriticalCommunication.count({ where: { id: { in: created } } })).toBe(0);

  const result = await applyFullRestore(raw, "default");
  expect(result.extraRowsRestored).toBeGreaterThanOrEqual(5);
  expect(await db.usgDoctor.findFirst({ where: { id: { in: created } } })).not.toBeNull();
  expect(await db.usgReportTemplate.findFirst({ where: { id: { in: created } } })).not.toBeNull();
  expect(await db.usgCriticalCommunication.findFirst({ where: { id: { in: created } } })).not.toBeNull();
  expect(await db.usgAudit.findFirst({ where: { id: { in: created } } })).not.toBeNull();

  // The provenance of a guessed image link is part of the record now: without it
  // a restored row would both lose its chip and become guessable again.
  const restored = await db.usgCareOrder.findFirst({ where: { id: { in: created } } });
  expect(restored?.uidLinkedBy).toBe("name+day, nearest");

  await wipe();
});

test("an older backup file without the new arrays still restores", async () => {
  const old = {
    format: "usg-clinic-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {},
    customPathologies: [],
    patients: [],
    reports: [],
  };
  const result = await applyFullRestore(old, "default");
  expect(result.extraRowsRestored).toBe(0);
});

test("the volume's free space is part of the status the doctor sees", async () => {
  const { backupStatus, freeBytesAt, backupsDir } = await import("@/lib/usg/backupServer");
  const dir = await backupsDir();
  const status = await backupStatus();
  expect(typeof status.freeBytes).toBe("number");
  expect(status.freeBytes).toBe(await freeBytesAt(dir));
});

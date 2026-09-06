/**
 * v6.9 — Critical Findings Communication Log + Follow-up Reminders tests.
 *
 * Both new features are tested against the REAL Prisma client + scratch
 * SQLite database (created by tests/global-setup.ts), so the round-trip
 * is exactly what the doctor uses in production.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  validateCommunicationInput,
  methodLabel,
  formatCommDate,
  COMMUNICATION_METHODS,
} from "@/lib/usg/criticalComm";

beforeEach(async () => {
  await db.usgCriticalCommunication.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
});

afterEach(async () => {
  await db.usgCriticalCommunication.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
});

async function seedReport(overrides: Partial<{ id: string; patientName: string; status: string }> = {}) {
  const r = await db.usgReport.create({
    data: {
      id: overrides.id ?? "test-report-1",
      patientName: overrides.patientName ?? "Test Patient",
      status: overrides.status ?? "FINALIZED",
      studyKey: "wa-female",
    },
  });
  return r;
}

describe("criticalComm.validateCommunicationInput", () => {
  it("accepts a valid input", () => {
    const errs = validateCommunicationInput({
      reportId: "r1",
      findingText: "Ectopic gestation with hemoperitoneum",
      communicatedTo: "Dr. Rao",
      communicatedAt: "2026-09-06T14:30:00.000Z",
      method: "phone",
    });
    expect(errs).toEqual([]);
  });

  it("rejects empty required fields", () => {
    const errs = validateCommunicationInput({});
    expect(errs).toHaveLength(5);
    expect(errs.map((e) => e.field).sort()).toEqual([
      "communicatedAt",
      "communicatedTo",
      "findingText",
      "method",
      "reportId",
    ]);
  });

  it("rejects unknown communication method", () => {
    const errs = validateCommunicationInput({
      reportId: "r1",
      findingText: "x",
      communicatedTo: "Dr.",
      communicatedAt: "2026-09-06T14:30:00.000Z",
      method: "carrier-pigeon",
    });
    expect(errs).toHaveLength(1);
    expect(errs[0].field).toBe("method");
  });

  it("accepts all five canonical methods", () => {
    for (const m of COMMUNICATION_METHODS) {
      const errs = validateCommunicationInput({
        reportId: "r1",
        findingText: "x",
        communicatedTo: "Dr.",
        communicatedAt: "2026-09-06T14:30:00.000Z",
        method: m,
      });
      expect(errs).toEqual([]);
    }
  });

  it("rejects invalid datetime", () => {
    const errs = validateCommunicationInput({
      reportId: "r1",
      findingText: "x",
      communicatedTo: "Dr.",
      communicatedAt: "not-a-date",
      method: "phone",
    });
    expect(errs).toHaveLength(1);
    expect(errs[0].field).toBe("communicatedAt");
  });

  it("rejects finding text > 1000 chars", () => {
    const errs = validateCommunicationInput({
      reportId: "r1",
      findingText: "x".repeat(1001),
      communicatedTo: "Dr.",
      communicatedAt: "2026-09-06T14:30:00.000Z",
      method: "phone",
    });
    expect(errs).toHaveLength(1);
    expect(errs[0].field).toBe("findingText");
  });
});

describe("criticalComm.formatting helpers", () => {
  it("methodLabel returns human-readable labels", () => {
    expect(methodLabel("phone")).toBe("Phone call");
    expect(methodLabel("whatsapp")).toBe("WhatsApp");
    expect(methodLabel("in-person")).toBe("In person");
    expect(methodLabel("unknown")).toBe("unknown"); // passthrough
  });

  it("formatCommDate formats a valid ISO date with day, month, year, time", () => {
    const out = formatCommDate("2026-09-06T14:30:00.000Z");
    expect(out).toMatch(/06/);
    expect(out).toMatch(/Sep/);
    expect(out).toMatch(/2026/);
  });

  it("formatCommDate handles null/undefined/invalid", () => {
    expect(formatCommDate(null)).toBe("—");
    expect(formatCommDate(undefined)).toBe("—");
    expect(formatCommDate("not-a-date")).toBe("—");
  });
});

describe("UsgCriticalCommunication persistence + cascade", () => {
  it("creates and reads back a communication log entry", async () => {
    const r = await seedReport();
    const entry = await db.usgCriticalCommunication.create({
      data: {
        reportId: r.id,
        findingText: "Ectopic with hemoperitoneum",
        communicatedTo: "Dr. Rao",
        communicatedAt: new Date("2026-09-06T14:30:00Z"),
        method: "phone",
        notes: "Asked patient to come back tomorrow",
      },
    });
    expect(entry.id).toBeTruthy();
    expect(entry.acknowledged).toBe(false);
    expect(entry.acknowledgedAt).toBeNull();

    const fetched = await db.usgCriticalCommunication.findUnique({ where: { id: entry.id } });
    expect(fetched?.findingText).toBe("Ectopic with hemoperitoneum");
    expect(fetched?.communicatedBy).toBe("self"); // default
  });

  it("marks an entry as acknowledged", async () => {
    const r = await seedReport();
    const entry = await db.usgCriticalCommunication.create({
      data: {
        reportId: r.id,
        findingText: "x",
        communicatedTo: "Dr. Rao",
        communicatedAt: new Date(),
        method: "phone",
      },
    });
    const acked = await db.usgCriticalCommunication.update({
      where: { id: entry.id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: "Dr. Rao",
      },
    });
    expect(acked.acknowledged).toBe(true);
    expect(acked.acknowledgedAt).toBeTruthy();
    expect(acked.acknowledgedBy).toBe("Dr. Rao");
  });

  it("cascade-deletes with the report", async () => {
    const r = await seedReport();
    await db.usgCriticalCommunication.create({
      data: {
        reportId: r.id,
        findingText: "x",
        communicatedTo: "Dr.",
        communicatedAt: new Date(),
        method: "phone",
      },
    });
    expect(await db.usgCriticalCommunication.count()).toBe(1);
    await db.usgReport.delete({ where: { id: r.id } });
    expect(await db.usgCriticalCommunication.count()).toBe(0);
  });
});

describe("UsgReport follow-up columns (v6.9)", () => {
  it("followUpDate + followUpNote persist and reload", async () => {
    const r = await seedReport();
    await db.usgReport.update({
      where: { id: r.id },
      data: {
        followUpDate: new Date("2026-12-15T00:00:00Z"),
        followUpNote: "Recheck ovarian cyst in 6 weeks",
      },
    });
    const reloaded = await db.usgReport.findUnique({ where: { id: r.id } });
    expect(reloaded?.followUpDate).toBeTruthy();
    expect(reloaded?.followUpNote).toBe("Recheck ovarian cyst in 6 weeks");
  });

  it("clears followUpDate by setting null", async () => {
    const r = await seedReport();
    await db.usgReport.update({
      where: { id: r.id },
      data: { followUpDate: new Date("2026-12-15T00:00:00Z") },
    });
    expect((await db.usgReport.findUnique({ where: { id: r.id } }))?.followUpDate).toBeTruthy();
    await db.usgReport.update({
      where: { id: r.id },
      data: { followUpDate: null, followUpNote: null },
    });
    const cleared = await db.usgReport.findUnique({ where: { id: r.id } });
    expect(cleared?.followUpDate).toBeNull();
    expect(cleared?.followUpNote).toBeNull();
  });

  it("defaults to null on a fresh report", async () => {
    const r = await seedReport();
    const fresh = await db.usgReport.findUnique({ where: { id: r.id } });
    expect(fresh?.followUpDate).toBeNull();
    expect(fresh?.followUpNote).toBeNull();
  });
});

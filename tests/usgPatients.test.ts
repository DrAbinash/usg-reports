/**
 * Patient registry tests (v5 phase 1) — against the scratch SQLite DB.
 *
 * The linking policy is the clinical contract here:
 *   same name + same phone  → one patient, history connects;
 *   blank phone NEVER merges into a phone'd same-name patient (strangers);
 *   phone typed later adopts the blank-phone row instead of duplicating;
 *   blank name → report stays unlinked (legacy behaviour preserved).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { linkPatient, listPatients, normalizeName, normalizePhone } from "@/lib/usg/patients";

beforeEach(async () => {
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
});

afterEach(async () => {
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
});

describe("normalisation keys", () => {
  it("collapses whitespace and case in names", () => {
    expect(normalizeName("  Dr.   RANI  Devi ")).toBe("dr. rani devi");
    expect(normalizeName("")).toBe("");
  });

  it("strips every non-digit from phones", () => {
    expect(normalizePhone("94312-34567")).toBe("9431234567");
    expect(normalizePhone("+91 94312 34567")).toBe("919431234567");
    expect(normalizePhone("RANI")).toBe("");
  });
});

describe("linkPatient matching policy", () => {
  it("creates one patient and reuses it for identical name+phone", async () => {
    const a = await linkPatient("Rani Devi", "9431234567");
    const b = await linkPatient("RANI  devi", "9431234567");
    expect(a).toBeTruthy();
    expect(b).toBe(a);
    expect(await db.usgPatient.count()).toBe(1);
  });

  it("keeps two same-name patients with different phones separate", async () => {
    const a = await linkPatient("Sita Kumari", "9000000001");
    const b = await linkPatient("Sita Kumari", "9000000002");
    expect(a).not.toBe(b);
    expect(await db.usgPatient.count()).toBe(2);
  });

  it("never merges a blank-phone save into a phone'd same-name patient", async () => {
    const phoneId = await linkPatient("Gita Rani", "9331111111");
    const blankId = await linkPatient("Gita Rani", "");
    expect(blankId).not.toBe(phoneId);
    expect(await db.usgPatient.count()).toBe(2);
  });

  it("adopts the blank-phone row when the phone arrives later", async () => {
    const blankId = (await linkPatient("Mita Devi", ""))!;
    const adoptedId = await linkPatient("Mita Devi", "9812345678");
    expect(adoptedId).toBe(blankId);
    const row = await db.usgPatient.findUnique({ where: { id: blankId } });
    expect(row?.normPhone).toBe("9812345678");
    expect(row?.phone).toBe("9812345678");
    expect(await db.usgPatient.count()).toBe(1);
  });

  it("returns null for a blank name (unlinked legacy row)", async () => {
    expect(await linkPatient("   ", "9999999999")).toBeNull();
  });

  it("links reports and the history counts come back per patient", async () => {
    const pid = (await linkPatient("Anita Singh", "9012345678"))!;
    await db.usgReport.createMany({
      data: [
        { patientName: "Anita Singh", patientId: pid, studyKey: "wa-female", status: "FINALIZED", serialNo: 1 },
        { patientName: "Anita Singh", patientId: pid, studyKey: "ob", status: "DRAFT" },
      ],
    });
    const list = await listPatients();
    const anita = list.find((p) => p.name === "Anita Singh");
    expect(anita?.scanCount).toBe(2);
    expect(list.filter((p) => p.name === "Anita Singh")).toHaveLength(1);
  });

  it("searches the registry by name or phone", async () => {
    await linkPatient("Rani Devi", "9431234567");
    await linkPatient("Sita Kumari", "9000000002");
    expect((await listPatients("sita")).map((p) => p.name)).toEqual(["Sita Kumari"]);
    expect((await listPatients("94312")).map((p) => p.name)).toEqual(["Rani Devi"]);
    expect(await listPatients("nonexistent")).toEqual([]);
  });
});

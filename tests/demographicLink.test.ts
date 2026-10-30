/**
 * The demographic link (v6.24).
 *
 * This clinic's USG machine follows no Modality Worklist and writes no accession
 * number, so a CARE bill row and its scan share no identifier until CARE's own
 * Orthanc intake delivers one. What they do share is the patient's name, the
 * scanning day and sometimes the referring doctor's name — enough to LINK a
 * study to its bill row, and never enough to merge two patients.
 *
 * The failure this guards against is the one that cannot be talked out of the
 * record afterwards: patient A's pictures inside patient B's report. So every
 * rule below is about refusing. #64's flood (1,218 of 2,301 rows) was the
 * opposite mistake — inventing rows instead of linking them.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import {
  linkOrdersByDemography,
  normalizeDoctor,
  planDemographicLinks,
  type DemographicOrder,
  type DemographicStudy,
} from "@/lib/usg/careSync";

const DAY = "2026-10-29";
const order = (over: Partial<DemographicOrder> & { id: string }): DemographicOrder => ({
  patientName: "Alfi Parween",
  studyDate: new Date(`${DAY}T10:30:00+05:30`),
  referringDoctor: "",
  ...over,
});
const study = (over: Partial<DemographicStudy> & { studyInstanceUid: string }): DemographicStudy => ({
  patientName: "Alfi Parween",
  studyDate: DAY,
  referringDoctor: "",
  ...over,
});

describe("planDemographicLinks — when it links", () => {
  test("one bill row, one study, same patient, same clinic day", () => {
    const p = planDemographicLinks([order({ id: "o1" })], [study({ studyInstanceUid: "UID-1" })]);
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1" }]);
    expect(p.ambiguous).toBe(0);
  });

  test("CARE's 'First Last' and the scanner's 'LAST^FIRST' are one patient", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", patientName: "Parween Alfi" })],
      [study({ studyInstanceUid: "UID-1", patientName: "ALFI  parween" })],
    );
    expect(p.links).toHaveLength(1);
  });

  test("two scans that day, and the doctor's reference picks one", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", referringDoctor: "Dr R K Sinha" })],
      [
        study({ studyInstanceUid: "UID-OTHER", referringDoctor: "Dr A K Verma" }),
        study({ studyInstanceUid: "UID-1", referringDoctor: "R K SINHA" }),
      ],
    );
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1" }]);
    expect(p.ambiguous).toBe(0);
  });

  test("two patients of the same name that day, and the referral identifies one bill row", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", referringDoctor: "Dr R K Sinha" }), order({ id: "o2", referringDoctor: "Dr A K Verma" })],
      [study({ studyInstanceUid: "UID-1", referringDoctor: "R K Sinha" })],
    );
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1" }]);
  });

  test("'Dr. R. K. Sinha' and 'R K SINHA' are the same referral", () => {
    expect(normalizeDoctor("Dr. R.K. Sinha")).toBe(normalizeDoctor("SINHA R K"));
  });
});

describe("planDemographicLinks — when it refuses", () => {
  test("two scans and no referral on either side is not a coin toss", () => {
    const p = planDemographicLinks([order({ id: "o1" })], [study({ studyInstanceUid: "UID-1" }), study({ studyInstanceUid: "UID-2" })]);
    expect(p.links).toHaveLength(0);
    expect(p.ambiguous).toBe(1);
  });

  test("two bill rows and one scan, with no referral to separate them", () => {
    const p = planDemographicLinks([order({ id: "o1" }), order({ id: "o2" })], [study({ studyInstanceUid: "UID-1" })]);
    expect(p.links).toHaveLength(0);
    expect(p.ambiguous).toBe(1);
  });

  test("a referral that matches nothing leaves the pair refused rather than guessing", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", referringDoctor: "Dr Nobody" })],
      [study({ studyInstanceUid: "UID-1", referringDoctor: "Dr A K Verma" }), study({ studyInstanceUid: "UID-2", referringDoctor: "Dr B" })],
    );
    expect(p.links).toHaveLength(0);
    expect(p.ambiguous).toBe(1);
  });

  test("different scanning days never link", () => {
    const p = planDemographicLinks([order({ id: "o1" })], [study({ studyInstanceUid: "UID-1", studyDate: "2026-10-28" })]);
    expect(p.links).toHaveLength(0);
    expect(p.ambiguous).toBe(0);
  });

  test("different patients never link", () => {
    const p = planDemographicLinks([order({ id: "o1", patientName: "Sital Jaiswal" })], [study({ studyInstanceUid: "UID-1" })]);
    expect(p.links).toHaveLength(0);
  });

  test("a bill row with no study date is counted, not guessed at", () => {
    const p = planDemographicLinks([order({ id: "o1", studyDate: null })], [study({ studyInstanceUid: "UID-1" })]);
    expect(p.links).toHaveLength(0);
    expect(p.skippedNoDay).toBe(1);
  });

  test("an evening scan stays on the clinic's day, not the UTC one", () => {
    // 23:30 IST on the 6th is 18:00 UTC on the 6th; 00:30 IST on the 7th is
    // 19:00 UTC on the 6th and must not be read as the 6th.
    const o = order({ id: "o1", studyDate: new Date("2026-10-06T19:00:00Z") });
    expect(planDemographicLinks([o], [study({ studyInstanceUid: "UID-1", studyDate: "2026-10-07" })]).links).toHaveLength(1);
    expect(planDemographicLinks([o], [study({ studyInstanceUid: "UID-2", studyDate: "2026-10-06" })]).links).toHaveLength(0);
  });
});

describe("linkOrdersByDemography — the only thing it writes", () => {
  beforeEach(async () => {
    await db.usgCareOrder.deleteMany();
  });

  test("sets the Study UID and leaves every other field alone", async () => {
    const created = await db.usgCareOrder.create({
      data: {
        clinicId: "default",
        careWorklistId: "4831",
        accessionNumber: null,
        patientName: "Alfi Parween",
        patientAge: "28",
        patientSex: "F",
        billNumber: "B-4831",
        referringDoctor: "Dr Neha Priya",
        testName: "USG Whole Abdomen",
        modality: "USG",
        studyDate: new Date(`${DAY}T10:30:00+05:30`),
        studyInstanceUid: null,
        status: "PENDING",
      },
    });

    const stats = await linkOrdersByDemography([study({ studyInstanceUid: "UID-99" })], "default");
    expect(stats.linked).toBe(1);
    expect(stats.errors).toBe(0);

    const after = await db.usgCareOrder.findFirstOrThrow({ where: { id: created.id } });
    expect(after.studyInstanceUid).toBe("UID-99");
    // A link is not an edit: the bill row keeps CARE's own values.
    expect(after.testName).toBe("USG Whole Abdomen");
    expect(after.referringDoctor).toBe("Dr Neha Priya");
    expect(after.status).toBe("PENDING");
    expect(after.accessionNumber).toBeNull();
    expect(after.billNumber).toBe("B-4831");
  });

  test("a second pass finds nothing left to do", async () => {
    await db.usgCareOrder.create({
      data: {
        clinicId: "default",
        careWorklistId: "4832",
        patientName: "Sital Jaiswal",
        patientAge: "26",
        patientSex: "F",
        billNumber: "B-4832",
        modality: "USG",
        studyDate: new Date(`${DAY}T11:30:00+05:30`),
        studyInstanceUid: null,
        status: "PENDING",
      },
    });
    const rows = [study({ studyInstanceUid: "UID-A", patientName: "Sital Jaiswal" })];
    expect((await linkOrdersByDemography(rows, "default")).linked).toBe(1);
    expect((await linkOrdersByDemography(rows, "default")).linked).toBe(0);
    expect(await db.usgCareOrder.count({ where: { patientName: "Sital Jaiswal" } })).toBe(1);
  });

  test("an ambiguous pair writes nothing at all", async () => {
    await db.usgCareOrder.create({
      data: {
        clinicId: "default",
        careWorklistId: "4833",
        patientName: "Rani Devi",
        patientAge: "34",
        patientSex: "F",
        billNumber: "B-4833",
        modality: "USG",
        studyDate: new Date(`${DAY}T09:00:00+05:30`),
        studyInstanceUid: null,
        status: "PENDING",
      },
    });
    const stats = await linkOrdersByDemography(
      [
        study({ studyInstanceUid: "UID-1", patientName: "Rani Devi" }),
        study({ studyInstanceUid: "UID-2", patientName: "Rani Devi" }),
      ],
      "default",
    );
    expect(stats.linked).toBe(0);
    expect(stats.ambiguous).toBe(1);
    expect(await db.usgCareOrder.count({ where: { patientName: "Rani Devi", studyInstanceUid: null } })).toBe(1);
  });
});

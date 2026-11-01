/**
 * The demographic link (v6.24, loosened for the trial run).
 *
 * This clinic's USG machine follows no Modality Worklist and writes no accession
 * number, so a CARE bill row and its scan share no identifier until CARE's own
 * Orthanc intake delivers one. What they do share is the patient's name, the
 * scanning day, the scanning minute and sometimes the referring doctor's name.
 *
 * The law was "unique hit or nothing", which made him do the joining by hand for
 * every ordinary day: two scans for one patient, or a bill raised after midnight.
 * It now takes the best candidate it can defend and writes the rule on the row,
 * so a guess is visible as a chip rather than silent. What it still refuses is
 * the coin flip — one name, one day, the same minute, nothing to separate them.
 *
 * The failure guarded against is the one that cannot be talked out of the record
 * afterwards: patient A's pictures inside patient B's report. #64's flood
 * (1,218 of 2,301 rows) was the opposite mistake — inventing rows instead of
 * linking them.
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
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1", rule: "name+day" }]);
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
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1", rule: "name+day, referral" }]);
    expect(p.ambiguous).toBe(0);
  });

  test("two patients of the same name that day, and the referral identifies one bill row", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", referringDoctor: "Dr R K Sinha" }), order({ id: "o2", referringDoctor: "Dr A K Verma" })],
      [study({ studyInstanceUid: "UID-1", referringDoctor: "R K Sinha" })],
    );
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1", rule: "name+day, referral" }]);
  });

  test("'Dr. R. K. Sinha' and 'R K SINHA' are the same referral", () => {
    expect(normalizeDoctor("Dr. R.K. Sinha")).toBe(normalizeDoctor("SINHA R K"));
  });

  // The join the old law refused outright and left for him to do by hand.
  test("two scans in one day reach the row whose hour they were taken at", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", studyDate: new Date(`${DAY}T16:45:00+05:30`) })],
      [
        study({ studyInstanceUid: "UID-MORNING", studyTime: "091500" }),
        study({ studyInstanceUid: "UID-EVENING", studyTime: "165000" }),
      ],
    );
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-EVENING", rule: "name+day, nearest" }]);
    expect(p.ambiguous).toBe(0);
  });

  test("two bill rows and two scans the same day pair up by scanning minute", () => {
    const p = planDemographicLinks(
      [
        order({ id: "o1", studyDate: new Date(`${DAY}T09:20:00+05:30`) }),
        order({ id: "o2", studyDate: new Date(`${DAY}T17:10:00+05:30`) }),
      ],
      [
        study({ studyInstanceUid: "UID-LATE", studyTime: "170500" }),
        study({ studyInstanceUid: "UID-EARLY", studyTime: "092500" }),
      ],
    );
    expect(p.links).toEqual([
      { orderId: "o1", studyInstanceUid: "UID-EARLY", rule: "name+day, nearest" },
      { orderId: "o2", studyInstanceUid: "UID-LATE", rule: "name+day, nearest" },
    ]);
  });

  test("an evening scan billed after midnight still reaches its row", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", studyDate: new Date(`${DAY}T00:20:00+05:30`) })],
      [study({ studyInstanceUid: "UID-1", studyDate: "2026-10-28", studyTime: "235000" })],
    );
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1", rule: "name+day ±1" }]);
    expect(p.ambiguous).toBe(0);
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

  test("a referral that contradicts the bill row is a veto, not a near miss", () => {
    // Two same-named patients referred by different doctors are different
    // people, so these never reach the board as candidates at all — which is
    // why this counts as nothing matched rather than as a coin flip.
    const p = planDemographicLinks(
      [order({ id: "o1", referringDoctor: "Dr Nobody" })],
      [study({ studyInstanceUid: "UID-1", referringDoctor: "Dr A K Verma" }), study({ studyInstanceUid: "UID-2", referringDoctor: "Dr B" })],
    );
    expect(p.links).toHaveLength(0);
    expect(p.ambiguous).toBe(0);
  });

  test("two days apart never link", () => {
    const p = planDemographicLinks([order({ id: "o1" })], [study({ studyInstanceUid: "UID-1", studyDate: "2026-10-27" })]);
    expect(p.links).toHaveLength(0);
    expect(p.ambiguous).toBe(0);
  });

  test("a same-day scan outranks a nearer-in-time one from the day before", () => {
    const p = planDemographicLinks(
      [order({ id: "o1", studyDate: new Date(`${DAY}T00:10:00+05:30`) })],
      [
        study({ studyInstanceUid: "UID-YESTERDAY", studyDate: "2026-10-28", studyTime: "235900" }),
        study({ studyInstanceUid: "UID-TODAY", studyTime: "001500" }),
      ],
    );
    expect(p.links).toEqual([{ orderId: "o1", studyInstanceUid: "UID-TODAY", rule: "name+day" }]);
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
    expect(
      planDemographicLinks([o], [study({ studyInstanceUid: "UID-1", studyDate: "2026-10-07" })]).links,
    ).toEqual([{ orderId: "o1", studyInstanceUid: "UID-1", rule: "name+day" }]);
    // The 6th is now reachable, but only as the ±1 guess — and the exact-day
    // study above still wins when both are on the board.
    expect(
      planDemographicLinks([o], [study({ studyInstanceUid: "UID-2", studyDate: "2026-10-06" })]).links,
    ).toEqual([{ orderId: "o1", studyInstanceUid: "UID-2", rule: "name+day ±1" }]);
    expect(
      planDemographicLinks([o], [study({ studyInstanceUid: "UID-2", studyDate: "2026-10-05" })]).links,
    ).toHaveLength(0);
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
    // The rule is recorded on the row: a same-day unique hit needs no chip.
    expect(after.uidLinkedBy).toBe("name+day");
    expect(stats.guessed).toBe(0);
    // A link is not an edit: the bill row keeps CARE's own values.
    expect(after.testName).toBe("USG Whole Abdomen");
    expect(after.referringDoctor).toBe("Dr Neha Priya");
    expect(after.status).toBe("PENDING");
    expect(after.accessionNumber).toBeNull();
    expect(after.billNumber).toBe("B-4831");
  });

  test("a guessed link carries the rule that guessed it", async () => {
    const created = await db.usgCareOrder.create({
      data: {
        clinicId: "default",
        careWorklistId: "4900",
        accessionNumber: null,
        patientName: "Alfi Parween",
        patientAge: "28",
        patientSex: "F",
        billNumber: "B-4900",
        modality: "USG",
        studyDate: new Date(`${DAY}T16:40:00+05:30`),
        studyInstanceUid: null,
        status: "PENDING",
      },
    });
    const stats = await linkOrdersByDemography(
      [
        study({ studyInstanceUid: "UID-MORNING", studyTime: "090000" }),
        study({ studyInstanceUid: "UID-EVENING", studyTime: "164500" }),
      ],
      "default",
    );
    expect(stats.linked).toBe(1);
    expect(stats.guessed).toBe(1);
    const after = await db.usgCareOrder.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.studyInstanceUid).toBe("UID-EVENING");
    expect(after.uidLinkedBy).toBe("name+day, nearest");
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

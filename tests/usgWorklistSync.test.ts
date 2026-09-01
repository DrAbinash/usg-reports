/**
 * v6.1 worklist identity fix — integration tests A–J against the REAL
 * Prisma client + scratch SQLite database (tests/global-setup.ts).
 *
 * The row shapes mirror the verified CARE production payload:
 *   { worklistId, accessionNumber: "", patientName, patientId, modality: "US",
 *     studyDate, studyInstanceUid, billingStatus: null }
 *
 *   A. US row, blank accession + valid StudyInstanceUID imports
 *   B. US row, blank accession + worklistId, no images yet → stays visible
 *   C. StudyInstanceUID exact match attaches the Orthanc study
 *   D. Populated-accession path still works (legacy bridge)
 *   E. Same patient name + different StudyInstanceUID → never merged
 *   F. null billingStatus does not suppress the row
 *   G. CT/MR rows are excluded
 *   H. Malformed / no-identity row is skipped with a diagnostic count
 *   I. Repeated sync is idempotent — no duplicate orders
 *   J. REPORTED state is never reset by resync
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import {
  attachOrthancStudies,
  decideImport,
  importCareRows,
  indexOrthancStudies,
  matchOrthancStudy,
  normalizeCareRow,
} from "@/lib/usg/careSync";
import type { CareWorklistItem } from "@/lib/usg/careClient";
import type { OrthancStudy } from "@/lib/usg/orthancClient";

// ── fixtures ────────────────────────────────────────────────────────────────

/** The EXACT verified production row (Sital Jaiswal) — blank accession. */
const PROD_ROW: CareWorklistItem = {
  worklistId: "4831",
  accessionNumber: "",
  patientName: "Sital Jaiswal",
  patientAge: "26/F",
  modality: "US",
  studyDate: "2026-09-01T00:00:00.000Z",
  studyInstanceUid: "1.2.276.0.26.1.1.1.2.2026.280.41706.2166193",
  billingStatus: null,
  patientId: 8127,
};

const orthancStudy = (uid: string, accession = ""): OrthancStudy => ({
  ID: `orthanc-${uid.slice(-6)}`,
  MainDicomTags: { StudyInstanceUID: uid, AccessionNumber: accession },
});

beforeEach(async () => {
  await db.usgCareOrder.deleteMany();
});

afterEach(async () => {
  await db.usgCareOrder.deleteMany();
});

// ── A + B + F: the production rows import and stay visible ─────────────────

describe("A · blank accession + StudyInstanceUID imports", () => {
  test("the verified production row lands in the worklist", async () => {
    const stats = await importCareRows([PROD_ROW]);
    expect(stats.imported).toBe(1);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4831" } });
    expect(order.patientName).toBe("Sital Jaiswal");
    expect(order.accessionNumber).toBeNull(); // never synthesized
    expect(order.studyInstanceUid).toBe("1.2.276.0.26.1.1.1.2.2026.280.41706.2166193");
    expect(order.status).toBe("PENDING");
  });

  test("images are linkable straight away — the UID came from CARE", async () => {
    await importCareRows([PROD_ROW]);
    const studies = [orthancStudy(PROD_ROW.studyInstanceUid!)];
    const attach = await attachOrthancStudies(studies);
    expect(attach.matchedByStudyUid).toBe(1);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4831" } });
    expect(order.studyInstanceUid).toBe(PROD_ROW.studyInstanceUid);
  });
});

describe("B · blank accession + worklistId only, no images yet", () => {
  test("imports and remains visible (awaiting images, not vanished)", async () => {
    const row: CareWorklistItem = {
      worklistId: "4832",
      accessionNumber: "",
      patientName: "No Images Yet",
      modality: "US",
      studyInstanceUid: "", // nothing from PACS yet either
      billingStatus: null,
    };
    const stats = await importCareRows([row]);
    expect(stats.imported).toBe(1);
    // No Orthanc studies at all — the order still exists, ready to report.
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4832" } });
    expect(order.studyInstanceUid).toBeNull();
    const attach = await attachOrthancStudies([]);
    expect(attach.awaitingImages).toBe(1);
    // …an unrelated study arriving does NOT link it (no fuzzy matching).
    const attach2 = await attachOrthancStudies([orthancStudy("1.2.840.113619.2.1.9")]);
    expect(attach2.awaitingImages).toBe(1); // still waiting, still visible
    // The real production flow: once PACS has the study, the ERP's worklist
    // row carries the StudyInstanceUID — the next sync links it exactly.
    await importCareRows([{ ...row, studyInstanceUid: "1.2.840.113619.2.1.9" }]);
    const linked = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4832" } });
    expect(linked.studyInstanceUid).toBe("1.2.840.113619.2.1.9");
    const attach3 = await attachOrthancStudies([orthancStudy("1.2.840.113619.2.1.9")]);
    expect(attach3.matchedByStudyUid).toBe(1);
    expect(attach3.awaitingImages).toBe(0);
  });
});

describe("C · StudyInstanceUID exact match attaches the Orthanc study", () => {
  test("accession-ful order gets its UID from an exact accession hit", async () => {
    await importCareRows([
      { worklistId: "100", accessionNumber: "CARE-24101", patientName: "Legacy Row", modality: "USG", studyInstanceUid: "" },
    ]);
    const attach = await attachOrthancStudies([
      orthancStudy("1.2.276.0.26.1.1.1.2.2026.280.1.1", "CARE-24101"),
      orthancStudy("1.2.276.0.26.1.1.1.2.2026.280.9.9", "CARE-OTHER"),
    ]);
    expect(attach.matchedByAccession).toBe(1);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { accessionNumber: "CARE-24101" } });
    expect(order.studyInstanceUid).toBe("1.2.276.0.26.1.1.1.2.2026.280.1.1");
  });

  test("two Orthanc studies sharing one accession = ambiguous, never 'first match'", async () => {
    await importCareRows([
      { worklistId: "101", accessionNumber: "DUP-ACC", patientName: "Ambiguous", modality: "US", studyInstanceUid: "" },
    ]);
    const attach = await attachOrthancStudies([
      orthancStudy("1.2.276.0.0.1", "DUP-ACC"),
      orthancStudy("1.2.276.0.0.2", "DUP-ACC"),
    ]);
    expect(attach.ambiguousMatches).toBe(1);
    expect(attach.matchedByAccession).toBe(0);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { accessionNumber: "DUP-ACC" } });
    expect(order.studyInstanceUid).toBeNull(); // untouched — patient safety
  });
});

describe("D · populated-accession path still works", () => {
  test("resolves by accession when the worklistId is new (legacy bridge)", async () => {
    await importCareRows([
      { worklistId: "200", accessionNumber: "CARE-90001", patientName: "First Sync", patientAge: "40/M", modality: "Ultrasound" },
    ]);
    // Same accession, ERP now also fills the worklistId/uid — ONE row.
    const stats = await importCareRows([
      { worklistId: "200", accessionNumber: "CARE-90001", patientName: "First Sync", patientAge: "41/M", modality: "Ultrasound", studyInstanceUid: "1.2.900.1" },
    ]);
    expect(stats.imported).toBe(0);
    expect(stats.updatedExisting).toBe(1);
    const count = await db.usgCareOrder.count({ where: { accessionNumber: "CARE-90001" } });
    expect(count).toBe(1);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { accessionNumber: "CARE-90001" } });
    expect(order.patientAge).toBe("41"); // refreshed, not duplicated
    expect(order.studyInstanceUid).toBe("1.2.900.1");
  });

  test("an accession-only row (no worklistId, no uid) still imports", async () => {
    const stats = await importCareRows([
      { accessionNumber: "ACC-ONLY-7", patientName: "Acc Only", modality: "US" },
    ]);
    expect(stats.imported).toBe(1);
  });
});

describe("E · same patient name, different StudyInstanceUID → never merged", () => {
  test("two rows, same name, distinct identities stay two orders", async () => {
    const rows: CareWorklistItem[] = [
      { worklistId: "300", accessionNumber: "", patientName: "Sital Jaiswal", modality: "US", studyInstanceUid: "1.2.276.0.1" },
      { worklistId: "301", accessionNumber: "", patientName: "Sital Jaiswal", modality: "US", studyInstanceUid: "1.2.276.0.2" },
    ];
    const stats = await importCareRows(rows);
    expect(stats.imported).toBe(2);
    expect(await db.usgCareOrder.count({ where: { patientName: "Sital Jaiswal" } })).toBe(2);

    // Each attaches to its OWN study — no cross-patient / cross-order linking.
    const attach = await attachOrthancStudies([orthancStudy("1.2.276.0.1"), orthancStudy("1.2.276.0.2")]);
    expect(attach.matchedByStudyUid).toBe(2);
    const a = await db.usgCareOrder.findFirstOrThrow({ where: { studyInstanceUid: "1.2.276.0.1" } });
    const b = await db.usgCareOrder.findFirstOrThrow({ where: { studyInstanceUid: "1.2.276.0.2" } });
    expect(a.id).not.toBe(b.id);
  });

  test("same name, no identity at all → still two separate orders? no — skipped (H)", () => {
    // Name-only is NOT an identity: rows without any stable identifier are
    // skipped, never deduped/merged by name.
    const n = normalizeCareRow({ worklistId: "", accessionNumber: "", patientName: "X", studyInstanceUid: "" });
    expect(decideImport(n)).toEqual({ kind: "skip", reason: "missingIdentity" });
  });
});

describe("F · null billingStatus does not suppress the row", () => {
  test("the production row (billingStatus null, testName blank) imports", async () => {
    const stats = await importCareRows([PROD_ROW]);
    expect(stats.imported).toBe(1);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4831" } });
    expect(order.billingStatus).toBeNull();
    expect(order.testName).toBe("");
    // And it is refreshable only by accession — null accession rows simply
    // opt out (the ERP skips them too); billing is never blocking.
  });
});

describe("G · CT/MR rows are excluded from the USG Studio", () => {
  test("non-ultrasound modalities are filtered with a count", async () => {
    const stats = await importCareRows([
      { ...PROD_ROW, worklistId: "500" },
      { worklistId: "501", accessionNumber: "CT-1", patientName: "CT Patient", modality: "CT" },
      { worklistId: "502", accessionNumber: "MR-1", patientName: "MR Patient", modality: "MR" },
    ]);
    expect(stats.careRowsReceived).toBe(3);
    expect(stats.ultrasoundRowsReceived).toBe(1);
    expect(stats.imported).toBe(1);
    expect(await db.usgCareOrder.count()).toBe(1);
  });
});

describe("H · malformed / no-identity rows are skipped with diagnostics", () => {
  test("no stable identifier → skippedMissingIdentity + safe reason", async () => {
    const stats = await importCareRows([
      { worklistId: "", accessionNumber: "", patientName: "Identity-less", modality: "US", studyInstanceUid: "" },
    ]);
    expect(stats.skippedMissingIdentity).toBe(1);
    expect(stats.imported).toBe(0);
    expect(stats.skippedReasons[0]).toContain("WL ?");
    expect(stats.skippedReasons[0]).not.toContain("Identity-less"); // no patient data in diagnostics
    expect(await db.usgCareOrder.count()).toBe(0);
  });

  test("no patient name → skippedNoName (patient safety)", async () => {
    const stats = await importCareRows([
      { worklistId: "600", accessionNumber: "", patientName: "", modality: "US", studyInstanceUid: "1.2.3" },
    ]);
    expect(stats.skippedNoName).toBe(1);
    expect(stats.imported).toBe(0);
  });
});

describe("I · repeated sync is idempotent", () => {
  test("same rows twice → no duplicates, second run updates only", async () => {
    const rows: CareWorklistItem[] = [
      PROD_ROW,
      { worklistId: "4840", accessionNumber: "CARE-24102", patientName: "Acc Patient", modality: "US", studyInstanceUid: "" },
    ];
    const first = await importCareRows(rows);
    expect(first.imported).toBe(2);
    const second = await importCareRows(rows);
    expect(second.imported).toBe(0);
    expect(second.updatedExisting).toBe(2);
    expect(await db.usgCareOrder.count()).toBe(2);

    // Blank accession arriving late must never blank a populated one.
    const third = await importCareRows([
      { worklistId: "4840", accessionNumber: "", patientName: "Acc Patient", modality: "US", studyInstanceUid: "1.2.999" },
    ]);
    expect(third.imported).toBe(0);
    const kept = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4840" } });
    expect(kept.accessionNumber).toBe("CARE-24102"); // preserved, never blanked
    expect(kept.studyInstanceUid).toBe("1.2.999"); // enriched
  });
});

describe("J · REPORTED state is never reset by resync", () => {
  test("a finalized order stays frozen — demographics and links untouched", async () => {
    await importCareRows([PROD_ROW]);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4831" } });
    await db.usgCareOrder.update({
      where: { id: order.id },
      data: { status: "REPORTED", reportId: "rep-1", careSyncedAt: new Date() },
    });
    // ERP sends changed demographics + the same identity.
    const stats = await importCareRows([
      { ...PROD_ROW, patientName: "Changed Name", patientAge: "99/F" },
    ]);
    expect(stats.imported).toBe(0);
    expect(stats.alreadyReported).toBe(1);
    expect(stats.updatedExisting).toBe(0);
    const frozen = await db.usgCareOrder.findFirstOrThrow({ where: { id: order.id } });
    expect(frozen.status).toBe("REPORTED");
    expect(frozen.patientName).toBe("Sital Jaiswal"); // the day's record, not overwritten
  });

  test("REPORTING keeps its status while demographics refresh", async () => {
    await importCareRows([PROD_ROW]);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "4831" } });
    await db.usgCareOrder.update({ where: { id: order.id }, data: { status: "REPORTING", reportId: "rep-2" } });
    await importCareRows([{ ...PROD_ROW, patientAge: "27/F" }]);
    const still = await db.usgCareOrder.findFirstOrThrow({ where: { id: order.id } });
    expect(still.status).toBe("REPORTING");
    expect(still.patientAge).toBe("27");
  });
});

// ── pure matching unit checks (the never-rules, isolated) ───────────────────

describe("matchOrthancStudy — the never-rules", () => {
  const { byUid, byAcc } = indexOrthancStudies([
    orthancStudy("1.2.276.0.26.1.1.1.2.2026.280.41706.2166193"),
    orthancStudy("1.2.999", "ACC-1"),
  ]);

  test("exact UID wins over everything", () => {
    const m = matchOrthancStudy({ studyInstanceUid: "1.2.276.0.26.1.1.1.2.2026.280.41706.2166193", accessionNumber: "ACC-1" }, byUid, byAcc);
    expect(m.kind).toBe("studyUid");
  });

  test("name fields are never consulted — only UID/accession inputs exist", () => {
    const m = matchOrthancStudy({ studyInstanceUid: null, accessionNumber: "ACC-1" }, byUid, byAcc);
    expect(m.kind).toBe("accession");
    const none = matchOrthancStudy({ studyInstanceUid: null, accessionNumber: null }, byUid, byAcc);
    expect(none.kind).toBe("none");
  });
});

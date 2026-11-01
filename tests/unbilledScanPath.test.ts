/**
 * The un-billed scan path (v6.23).
 *
 * A study the bill desk never billed is not turned into a pseudo-order any
 * more — the sync used to write 1,218 such rows onto a 2,301-row worklist,
 * which is what made the list unreadable and made a cleanup script necessary.
 * An un-billed scan now lives only in the live PACS queue until the doctor
 * drafts it, and the row it creates says what a scan can honestly say: the
 * patient's details, the referring doctor's name, and the Study UID that
 * reaches the images. No accession claimed, no worklist id invented, no
 * catalogued test name made up.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireSession: (...args: unknown[]) => requireSession(...args),
  getActiveClinicId: async () => "default",
}));

const listRecentUltrasoundStudies = vi.fn();
vi.mock("@/lib/usg/orthancClient", () => ({
  listRecentUltrasoundStudies: (...args: unknown[]) =>
    listRecentUltrasoundStudies(...args),
}));

import { db } from "@/lib/db";
import { GET as pacsQueue } from "@/app/api/usg/worklist/pacs/route";
import { POST as pacsDraft } from "@/app/api/usg/reports/pacs-draft/route";

const scan = (over: Record<string, unknown> = {}) => ({
  studyInstanceUid: "1.2.840.unbilled.1",
  accessionNumber: "ACC-SCAN-1",
  patientName: "Sample Patientone",
  patientSex: "F",
  patientAge: "34",
  referringDoctor: "Dr R K Sinha",
  testName: "",
  studyDate: "2026-10-29",
  studyTime: "090500",
  ...over,
});

beforeEach(async () => {
  requireSession.mockReset();
  requireSession.mockResolvedValue(null);
  listRecentUltrasoundStudies.mockReset();
  await db.usgCareOrder.deleteMany();
  await db.usgReport.deleteMany();
});

describe("GET /api/usg/worklist/pacs — the scan reports only what the DICOM header says", () => {
  it("leaves the exam name blank when the study has no description", async () => {
    listRecentUltrasoundStudies.mockResolvedValue({ ok: true, data: [scan()] });
    const body = (await (await pacsQueue()).json()) as { rows: any[] };
    expect(body.rows).toHaveLength(1);
    // "USG Study" used to be invented here, and this payload is POSTed back to
    // pacs-draft — so the invention landed in the database as a billed test.
    expect(body.rows[0].testName).toBe("");
    expect(body.rows[0].patientName).toBe("Sample Patientone");
    expect(body.rows[0].referringDoctor).toBe("Dr R K Sinha");
  });

  it("keeps a real Study Description", async () => {
    listRecentUltrasoundStudies.mockResolvedValue({
      ok: true,
      data: [scan({ testName: "USG Obstric" })],
    });
    const body = (await (await pacsQueue()).json()) as { rows: any[] };
    expect(body.rows[0].testName).toBe("USG Obstric");
  });
});

describe("POST /api/usg/reports/pacs-draft — a drafted scan is not a bill", () => {
  const post = (row: Record<string, unknown>) =>
    pacsDraft(
      new NextRequest("http://localhost/api/usg/reports/pacs-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(row),
      }),
    );

  it("writes the patient and the referring doctor, and no bill identity", async () => {
    const res = await post(scan());
    expect(res.status).toBe(200);
    const order = await db.usgCareOrder.findFirstOrThrow({
      where: { studyInstanceUid: "1.2.840.unbilled.1" },
    });
    expect(order.patientName).toBe("Sample Patientone");
    expect(order.patientAge).toBe("34");
    expect(order.patientSex).toBe("F");
    expect(order.referringDoctor).toBe("Dr R K Sinha");
    // The two fields this whole change is about: the scan cannot claim a bill
    // desk row it does not have, and it cannot claim an accession the ERP owns.
    expect(order.careWorklistId).toBeNull();
    expect(order.accessionNumber).toBeNull();
    expect(order.testName).toBe("");
  });

  it("stores the exam name the scanner actually wrote, verbatim", async () => {
    await post(scan({ studyInstanceUid: "1.2.840.unbilled.2", testName: "USG Obstric" }));
    const order = await db.usgCareOrder.findFirstOrThrow({
      where: { studyInstanceUid: "1.2.840.unbilled.2" },
    });
    expect(order.testName).toBe("USG Obstric");
  });

  it("re-opening the same scan returns the draft it already made, without a second row", async () => {
    const first = (await (await post(scan())).json()) as { reportId: string };
    const second = (await (await post(scan())).json()) as { reportId: string };
    expect(second.reportId).toBe(first.reportId);
    expect(await db.usgCareOrder.count({ where: { studyInstanceUid: "1.2.840.unbilled.1" } })).toBe(1);
    expect(await db.usgReport.count({ where: { id: first.reportId } })).toBe(1);
  });
});

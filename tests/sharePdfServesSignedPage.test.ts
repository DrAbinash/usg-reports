/**
 * The PDF a patient downloads from a share link must be the sheet the clinic
 * signed.
 *
 * `/share/[token]` already renders `reportHtml` — the page frozen at finalize,
 * with the letterhead, the wording and the verification QR of that moment. The
 * PDF beside it did not: it re-resolved the report against today's Settings,
 * today's normal overrides and today's catalog wording. So a clinic that changed
 * its font, its logo or a finding's sentence after signing produced two different
 * documents from one register number, and the one the patient kept was the
 * changed one.
 *
 * What these tests pin:
 *  - the frozen page is what reaches the renderer, and nothing is re-rendered;
 *  - when the browser renderer is missing, the vector fallback still uses the
 *    print settings the report was signed with, not today's;
 *  - the download is named by its register number, never by the patient — this
 *    endpoint has no session, and a filename travels further than the screen;
 *  - it is not cacheable, and the download is written to the activity log;
 *  - a withdrawn link produces no file and no audit row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  rendered: [] as string[],
  pdfInputs: [] as Record<string, unknown>[],
  available: true,
}));

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

vi.mock("@/lib/usg/pdfRenderHtml", () => ({
  browserPdfAvailable: () => h.available,
  renderHtmlToPdf: (html: string) => {
    h.rendered.push(html);
    return Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  },
}));

vi.mock("@/lib/usg/pdf", () => ({
  buildUsgReportPdf: (input: Record<string, unknown>) => {
    h.pdfInputs.push(input);
    return Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  },
}));

vi.mock("@/lib/usg/qrServer", () => ({
  payloadInputFor: () => null,
  qrPngFor: async () => null,
  qrDataUrlFor: async () => null,
}));

import { GET as sharePdf } from "@/app/api/usg/share/[token]/pdf/route";
import { db } from "@/lib/db";
import { createShareToken, shareSigningSecret } from "@/lib/usg/secureShare";
import { getSettings } from "@/lib/settings";

/** A signed report exactly as finalize leaves it: a frozen page and the dials it was signed with. */
async function signedReport(over: Record<string, unknown> = {}) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      patientAge: "34",
      patientSex: "M",
      studyKey: "wa-male",
      stateJson: JSON.stringify({ studyKey: "wa-male", organs: [] }),
      findings: "LIVER: Normal.",
      impression: "No significant abnormality detected.",
      status: "FINALIZED",
      serialNo: 7781,
      scanDate: new Date("2026-10-08T05:00:00Z"),
      finalizedAt: new Date("2026-10-08T05:30:00Z"),
      reportHtml: "<html><body>SIGNED PAGE — hospital as it read on 8 Oct</body></html>",
      printSettingsJson: JSON.stringify({ hospitalName: "Hope Hospital (as signed)", usgPrintStyle: "premium" }),
      ...over,
    },
  });
}

function tokenFor(reportId: string) {
  return createShareToken(reportId, { secret: shareSigningSecret(), now: Date.now() });
}

async function call(reportId: string, token = tokenFor(reportId)) {
  const url = new URL(`http://clinic/api/usg/share/${encodeURIComponent(token)}/pdf`);
  return sharePdf(
    new NextRequest(url.toString(), { method: "GET", headers: { host: "clinic.example" } }),
    { params: Promise.resolve({ token }) },
  );
}

beforeEach(async () => {
  h.rendered = [];
  h.pdfInputs = [];
  h.available = true;
  await db.usgReportVersion.deleteMany();
  await db.usgReportImage.deleteMany();
  await db.usgAudit.deleteMany();
  await db.usgCareOrder.deleteMany();
  await db.usgReport.deleteMany();
});

describe("the file is the document that was signed", () => {
  it("renders the frozen page and re-resolves nothing", async () => {
    const report = await signedReport();
    const res = await call(report.id);
    expect(res.status).toBe(200);
    expect(h.rendered).toEqual([report.reportHtml]);
    expect(h.pdfInputs).toEqual([]);
  });

  it("falls back to the vector generator with the signed dials, not today's", async () => {
    const report = await signedReport();
    h.available = false;
    // Move today's letterhead off the signed one first, so "the PDF used the
    // snapshot" is a difference this test can actually observe.
    await db.hospitalSettings.upsert({
      where: { id: "singleton" },
      update: { usgPrintStyle: "classic", hospitalName: "Renamed after signing" },
      create: { id: "singleton", usgPrintStyle: "classic", hospitalName: "Renamed after signing" },
    });
    const settings = await getSettings();
    expect((settings as { usgPrintStyle?: string }).usgPrintStyle).toBe("classic");

    const res = await call(report.id);
    expect(res.status).toBe(200);
    expect(h.rendered).toEqual([]);
    expect(h.pdfInputs).toHaveLength(1);
    const used = h.pdfInputs[0].settings as Record<string, unknown>;
    expect(used.usgPrintStyle).toBe("premium");
    expect(used.hospitalName).toBe("Hope Hospital (as signed)");
  });

  it("still answers a report that was signed before pages were frozen", async () => {
    const report = await signedReport({ reportHtml: null });
    const res = await call(report.id);
    expect(res.status).toBe(200);
    expect(h.rendered).toEqual([]);
    expect(h.pdfInputs).toHaveLength(1);
  });
});

describe("a download from a link that needs no session", () => {
  it("is named by its register number and never by the patient", async () => {
    const report = await signedReport();
    const cd = (await call(report.id)).headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("7781");
    expect(cd.toLowerCase()).not.toContain("sample");
    expect(cd.toLowerCase()).not.toContain("patientone");
  });

  it("is not cacheable and not indexable", async () => {
    const res = await call((await signedReport()).id);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("leaves a line in the activity log", async () => {
    const report = await signedReport();
    await call(report.id);
    const row = await db.usgAudit.findFirst({ where: { reportId: report.id, action: "report.sharePdf" } });
    expect(row?.detail).toContain("shared PDF downloaded");
    expect(row?.serialNo).toBe(7781);
  });

  it("a withdrawn link gives no file and no log", async () => {
    const report = await signedReport();
    // Mint first, withdraw after: a token issued before the cutoff is the case
    // revocation exists for. (Revoking and then sharing again must still work,
    // so a link minted after the cutoff stays live — see secureShare.ts.)
    const token = tokenFor(report.id);
    await db.usgReport.update({ where: { id: report.id }, data: { shareRevokedAt: new Date(Date.now() + 60_000) } });
    const res = await call(report.id, token);
    expect(res.status).toBe(410);
    expect(h.rendered).toEqual([]);
    expect(await db.usgAudit.count({ where: { reportId: report.id } })).toBe(0);
  });

  it("an expired or forged token gives nothing", async () => {
    const report = await signedReport();
    const stale = createShareToken(report.id, { secret: shareSigningSecret(), now: Date.now() - 30 * 864e5 });
    const res = await call(report.id, stale);
    expect(res.status).toBe(410);
    const forged = await call(report.id, "not-a-real-token");
    expect(forged.status).toBe(400);
    expect(h.rendered).toEqual([]);
  });

  it("a draft is not shareable", async () => {
    const report = await signedReport({ status: "DRAFT", reportHtml: null });
    expect((await call(report.id)).status).toBe(404);
  });
});

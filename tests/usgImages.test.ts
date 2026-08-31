/**
 * Report still-image tests (v5 phase 4).
 *
 * Contract: only PNG/JPEG/WebP data URLs under 1.5 MB are accepted; the
 * printed report embeds the grid with captions and renumbers the Impression
 * band; deleting a report cascades its images.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { IMAGE_MAX_BYTES, validateImageDataUrl } from "@/lib/usg/images";
import { buildUsgReportHtml, formatUsgSerial } from "@/lib/usg/print";
import { initialState, getStudy } from "@/lib/usg/studies";
import { makeLookup, resolve } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";

const SETTINGS = {
  appTitle: "CARE USG Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "",
  phone: "",
  email: "",
  logoUrl: "",
  footerMessage: "",
  usgDoctorName: "Dr. Sugandha",
  usgDoctorQual: "",
  usgDoctorRegNo: "",
  usgMachineLine: "",
  usgShowMachine: false,
  usgFooterLine: "",
  usgDeclarationLine: "",
};

const PATIENT = { name: "Rani Devi", age: "30", sex: "F", referredBy: "", date: "01-Sep-2026" };

const png1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function resolvedReport() {
  return resolve(initialState("wa-female"), makeLookup(USG_PATHOLOGIES_ALL), "");
}

beforeEach(async () => {
  await db.usgReportImage.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
});

afterEach(async () => {
  await db.usgReportImage.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
});

describe("image data-URL validation", () => {
  it("accepts a PNG data URL", () => {
    expect(validateImageDataUrl(png1x1)).toEqual({ ok: true, mime: "image/png", bytes: expect.any(Number) });
  });

  it("accepts jpeg and webp, normalising image/jpg", () => {
    expect(validateImageDataUrl("data:image/jpeg;base64,AAAA").ok).toBe(true);
    expect(validateImageDataUrl("data:image/jpg;base64,AAAA").ok).toBe(true);
    expect(validateImageDataUrl("data:image/webp;base64,AAAA").ok).toBe(true);
  });

  it("rejects non-image and malformed payloads", () => {
    expect(validateImageDataUrl("data:application/pdf;base64,AAAA").ok).toBe(false);
    expect(validateImageDataUrl("https://example.com/x.png").ok).toBe(false);
    expect(validateImageDataUrl("").ok).toBe(false);
    expect(validateImageDataUrl("data:image/png;base64,not base64!!").ok).toBe(false);
  });

  it("rejects stills over 1.5 MB", () => {
    // ~2 MB of base64 padding
    const big = `data:image/png;base64,${"A".repeat(Math.ceil((IMAGE_MAX_BYTES + 200_000) * 4 / 3))}`;
    const r = validateImageDataUrl(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("too large");
  });
});

describe("print embeds the stills grid", () => {
  it("renders the USG Images band + 2-up grid with captions and escaped src", () => {
    const html = buildUsgReportHtml(
      SETTINGS,
      { ...PATIENT, serial: formatUsgSerial(7) },
      resolvedReport(),
      [
        { dataUrl: png1x1, caption: "Longitudinal view" },
        { dataUrl: png1x1, caption: "Transverse view" },
      ],
    );
    expect(html).toContain("USG Images");
    expect(html).toContain("images-grid");
    expect(html.match(/<figure class="img-cell">/g)?.length).toBe(2);
    expect(html).toContain("Longitudinal view");
    expect(html).toContain('alt="USG still"');
    // Impression band renumbers to 3 (no technique, with images)
    expect(html).toContain('<span class="n">3</span>Impression');
  });

  it("no images → no band, Impression stays numbered 2", () => {
    const html = buildUsgReportHtml(SETTINGS, PATIENT, resolvedReport());
    expect(html).not.toContain("USG Images");
    expect(html).toContain('<span class="n">2</span>Impression');
  });

  it("captions are HTML-escaped", () => {
    const html = buildUsgReportHtml(SETTINGS, PATIENT, resolvedReport(), [
      { dataUrl: png1x1, caption: "<script>alert(1)</script>" },
    ]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("image persistence + cascade", () => {
  it("attaches, orders, and cascade-deletes with the report", async () => {
    const report = await db.usgReport.create({
      data: { patientName: "Test Patient", studyKey: "wa-female", status: "DRAFT" },
    });
    await db.usgReportImage.createMany({
      data: [
        { reportId: report.id, dataUrl: png1x1, caption: "first", sortOrder: 10 },
        { reportId: report.id, dataUrl: png1x1, caption: "second", sortOrder: 20 },
      ],
    });
    const rows = await db.usgReportImage.findMany({
      where: { reportId: report.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(rows.map((r) => r.caption)).toEqual(["first", "second"]);

    await db.usgReport.delete({ where: { id: report.id } });
    expect(await db.usgReportImage.count()).toBe(0);
  });
});

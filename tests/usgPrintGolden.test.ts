/**
 * IMMUTABLE REFEREE — never run vitest with -u against this file; baselines change only by deliberate human decision.
 *
 * Golden HTML snapshots for the USG print letterhead (8 cases).
 * Baselines 1–3 (classic / premium / sidebar) are the original fossil referees.
 * Baselines 04–08 were added deliberately via scripts/generateMissingBaselines.ts
 * (throwaway) — never regenerate with `vitest -u`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildUsgReportHtml } from "@/lib/usg/print";
import { initialState } from "@/lib/usg/studies";
import { applyPathology, makeLookup, resolve } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";

const SETTINGS = {
  appTitle: "CARE USG Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "Subhash Chowk, Deoghar",
  phone: "06432-123456",
  email: "care@example.com",
  logoUrl: "",
  footerMessage: "Precision. Compassion. Care.",
  usgDoctorName: "Dr. Sugandha",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "J/12345",
  usgMachineLine: "GE Voluson Pro",
  usgShowMachine: true,
  usgFooterLine: "Correlate clinically.",
  usgDeclarationLine: "",
  usgPrintCompact: false,
  usgPrintPaper: "a4",
  usgSignatureUrl: "",
  usgPrintFontSize: 10,
  usgPrintLineHeight: 1.4,
  usgPrintSpacing: "tight",
  usgPrintShowTechnique: true,
  usgPrintShowThanks: true,
  usgSidebarPosition: "right",
  usgLogoPosition: "left",
  usgLogoSizeMm: 14,
};

const PATIENT = {
  name: "Rani Devi",
  age: "30",
  sex: "F",
  referredBy: "Dr. Kumar",
  date: "01-Sep-2026",
  serial: "USG-0001",
};

const REF_MS = Date.parse("2026-09-01T12:00:00.000Z");
const lookup = makeLookup(USG_PATHOLOGIES_ALL);

function resolved() {
  // Fatty Gr I selected → liver section is abnormal (must print bold / <strong>).
  const state = applyPathology(initialState("wa-female"), "liver", "liver-fatty-g1", lookup);
  return resolve(state, lookup, "Routine transabdominal scan.");
}

function normalize(html: string): string {
  // Collapse volatile whitespace only — keep structure for fossil detection.
  return html.replace(/\r\n/g, "\n").trim() + "\n";
}

describe("USG print golden snapshots", () => {
  test("classic letterhead", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "classic" },
      PATIENT,
      resolved(),
    );
    expect(html).not.toMatch(/\n\s*""\s*\n/);
    expect(html).not.toMatch(/\.tail\s*\{[^}]*position:\s*absolute/i);
    expect(html).not.toMatch(/\.sig-block\s*\{[^}]*position:\s*absolute/i);
    expect(normalize(html)).toMatchFileSnapshot("__golden__/print-classic.html");
  });

  test("premium letterhead", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium" },
      PATIENT,
      resolved(),
    );
    expect(html).not.toMatch(/\n\s*""\s*\n/);
    expect(html).not.toMatch(/\.tail\s*\{[^}]*position:\s*absolute/i);
    expect(html).not.toMatch(/\.sig-block\s*\{[^}]*position:\s*absolute/i);
    expect(normalize(html)).toMatchFileSnapshot("__golden__/print-premium.html");
  });

  test("premium_sidebar letterhead — no demography duplication", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium_sidebar" },
      PATIENT,
      resolved(),
      [{ dataUrl: "data:image/png;base64,AAAA", caption: "still" }],
    );
    // Orphaned duplicate demography labels must stay gone.
    expect(html).not.toMatch(/Study Date/);
    expect(html).not.toMatch(/Age \/ Gender/);
    expect(html).not.toMatch(/Ref\. Doctor/);
    // Premature strip close that left orphaned fields outside patient-strip.
    expect(html).not.toMatch(/<\/div><\/div>\s*<div class="field"><div class="label">Study Date/);
    expect(html).toMatch(/USG No\./);
    expect(normalize(html)).toMatchFileSnapshot("__golden__/print-sidebar.html");
  });
});

describe("USG print golden snapshots — extended referee (04–08)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: REF_MS });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("04 abdomen A5 compact", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium", usgPrintPaper: "a5", usgPrintCompact: true },
      PATIENT,
      resolved(),
    );
    expect(normalize(html)).toMatchFileSnapshot("__golden__/04-abdomen-a5-compact.html");
  });

  test("05 OB provisional watermark", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium" },
      { ...PATIENT, name: "Sita Kumari", age: "26", serial: "USG-0002", provisional: true },
      resolve(initialState("ob"), lookup, "Antenatal scan."),
    );
    expect(html).toMatch(/PROVISIONAL/i);
    expect(normalize(html)).toMatchFileSnapshot("__golden__/05-ob-provisional.html");
  });

  test("06 thyroid sidebar letterhead", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium_sidebar" },
      { ...PATIENT, name: "Meera Devi", age: "45", sex: "F", serial: "USG-0003" },
      resolve(initialState("thyroid"), lookup, "High-resolution thyroid ultrasound."),
      [{ dataUrl: "data:image/png;base64,AAAA", caption: "thyroid still" }],
    );
    expect(normalize(html)).toMatchFileSnapshot("__golden__/06-thyroid-sidebar.html");
  });

  test("07 OB BPP grid organ", () => {
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium" },
      { ...PATIENT, name: "Anita Devi", age: "28", serial: "USG-0004" },
      resolve(initialState("ob-bpp"), lookup, "Biophysical profile scan."),
    );
    expect(html).toMatch(/grid/i);
    expect(normalize(html)).toMatchFileSnapshot("__golden__/07-ob-bpp-grid.html");
  });

  test("08 abdomen images + QR footer", () => {
    const qrPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const html = buildUsgReportHtml(
      { ...SETTINGS, usgPrintStyle: "premium" },
      PATIENT,
      resolved(),
      [
        { dataUrl: "data:image/png;base64,AAAA", caption: "liver long" },
        { dataUrl: "data:image/png;base64,BBBB", caption: "kidney coronal" },
      ],
      { dataUrl: qrPng },
    );
    expect(html).toMatch(/scan to verify|verification QR/i);
    expect(normalize(html)).toMatchFileSnapshot("__golden__/08-abdomen-images-qr.html");
  });
});

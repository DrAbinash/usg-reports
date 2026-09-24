/**
 * Golden HTML snapshots for the USG print letterhead.
 *
 * These catch P0 print fossils (stray masthead quotes, absolute signature pin,
 * sidebar demography duplication) so they cannot silently return.
 *
 * Update ONLY via:
 *   npx vitest run -u tests/usgPrintGolden.test.ts
 */
import { describe, expect, test } from "vitest";
import { buildUsgReportHtml } from "@/lib/usg/print";
import { initialState } from "@/lib/usg/studies";
import { makeLookup, resolve } from "@/lib/usg/composer";
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

function resolved() {
  return resolve(initialState("wa-female"), makeLookup(USG_PATHOLOGIES_ALL), "Routine transabdominal scan.");
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

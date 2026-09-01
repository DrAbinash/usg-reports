/**
 * v6.2 print layout fine-tuning — tests against the REAL print/PDF builders.
 *
 * What the doctor asked for, and what each block proves:
 *
 *   • Font size + line-height dials land in the printed CSS, and stray
 *     values are clamped so the letterhead can never be wrecked.
 *   • The Technique band is switchable; section numbering follows whatever
 *     actually prints (both HTML and server-side PDF).
 *   • The "Thanks For Your Referral." tagline is switchable.
 *   • The trailing block (signature + PC-PNDT + declaration + footer) moves
 *     to a second page as ONE unit — a lone signature never spills — and
 *     the default trailing gaps got tighter.
 *   • A5 keeps its own tuned font sizes but still honours line-height.
 *   • Bill-desk blanks: an ERP "" never blanks stored order demographics,
 *     and a repeat patient's age/referral doctor carry forward from their
 *     most recent local report when the bridge sends blanks.
 *   • Settings persistence clamps the dials (Settings → Save path).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { db } from "@/lib/db";
import { buildUsgReportHtml } from "@/lib/usg/print";
import { buildUsgReportPdf } from "@/lib/usg/pdf";
import { initialState } from "@/lib/usg/studies";
import { makeLookup, resolve } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { importCareRows } from "@/lib/usg/careSync";
import { latestKnownDemographics, linkPatient } from "@/lib/usg/patients";
import { getSettings, updateSettings } from "@/lib/settings";
import type { CareWorklistItem } from "@/lib/usg/careClient";

const BASE_SETTINGS = {
  appTitle: "CARE USG Studio",
  hospitalName: "CARE Diagnostics",
  addressLine: "Deoghar",
  phone: "",
  email: "",
  logoUrl: "",
  footerMessage: "",
  usgDoctorName: "Dr. Sugandha",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "J/12345",
  usgMachineLine: "GE Voluson Pro",
  usgShowMachine: true,
  usgFooterLine: "Correlate clinically.",
  usgDeclarationLine: "declaration line",
};

const PATIENT = { name: "Rani Devi", age: "30", sex: "F", referredBy: "Dr. Kumar", date: "01-Sep-2026" };

function resolvedReport(technique = "Routine transabdominal scan.") {
  return resolve(initialState("wa-female"), makeLookup(USG_PATHOLOGIES_ALL), technique);
}

beforeEach(async () => {
  await db.usgCareOrder.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
  await db.hospitalSettings.deleteMany();
});

afterEach(async () => {
  await db.usgCareOrder.deleteMany();
  await db.usgReport.deleteMany();
  await db.usgPatient.deleteMany();
  await db.hospitalSettings.deleteMany();
});

// ── Font size + line-height dials ──────────────────────────────────────────

describe("font size and line-height dials", () => {
  test("the chosen font size and line-height land in the CSS", () => {
    const html = buildUsgReportHtml(
      { ...BASE_SETTINGS, usgPrintFontSize: 9, usgPrintLineHeight: 1.7 },
      PATIENT,
      resolvedReport(),
    );
    expect(html).toContain("font-size: 9pt");
    expect(html).toContain("line-height: 1.7");
    // element sizes go relative so the dial scales the whole letterhead
    expect(html).toContain("table.patient { font-size: 0.9em; }");
  });

  test("absent dials keep the classic defaults", () => {
    const html = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport());
    expect(html).toContain("font-size: 10.5pt");
    expect(html).toContain("line-height: 1.5");
  });

  test("out-of-range values are clamped (font 8.5–13, line-height 1.15–1.9)", () => {
    const tooBig = buildUsgReportHtml(
      { ...BASE_SETTINGS, usgPrintFontSize: 99, usgPrintLineHeight: 9 },
      PATIENT,
      resolvedReport(),
    );
    expect(tooBig).toContain("font-size: 13pt");
    expect(tooBig).toContain("line-height: 1.9");
    const tooSmall = buildUsgReportHtml(
      { ...BASE_SETTINGS, usgPrintFontSize: 5, usgPrintLineHeight: 0.5 },
      PATIENT,
      resolvedReport(),
    );
    expect(tooSmall).toContain("font-size: 8.5pt");
    expect(tooSmall).toContain("line-height: 1.15");
  });
});

// ── Technique band toggle + numbering ──────────────────────────────────────

describe("technique row toggle", () => {
  test("on (default) — Technique prints and Findings is numbered 2", () => {
    const html = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport("Routine scan."));
    expect(html).toContain("Technique</h2>");
    expect(html).toContain("Routine scan.");
    expect(html).toMatch(/<span class="n">2<\/span>Findings/);
    expect(html).toMatch(/<span class="n">3<\/span>Impression/);
  });

  test("off — no Technique band; Findings starts at 1; text never prints", () => {
    const html = buildUsgReportHtml(
      { ...BASE_SETTINGS, usgPrintShowTechnique: false },
      PATIENT,
      resolvedReport("Routine scan."),
    );
    expect(html).not.toContain("Technique</h2>");
    expect(html).not.toContain("Routine scan.");
    expect(html).toMatch(/<span class="n">1<\/span>Findings/);
    expect(html).toMatch(/<span class="n">2<\/span>Impression/);
  });

  test("blank technique never prints a band even with the toggle on", () => {
    const html = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport(""));
    expect(html).not.toContain("Technique</h2>");
  });

  test("PDF honours the toggle — TECHNIQUE absent, FINDINGS numbered 1", async () => {
    const withTech = await pdfText(buildUsgReportPdf({ settings: BASE_SETTINGS, patient: PATIENT, resolved: resolvedReport("Routine scan.") }));
    expect(withTech).toContain(hex("TECHNIQUE"));
    const withoutTech = await pdfText(
      buildUsgReportPdf({ settings: { ...BASE_SETTINGS, usgPrintShowTechnique: false }, patient: PATIENT, resolved: resolvedReport("Routine scan.") }),
    );
    expect(withoutTech).not.toContain(hex("TECHNIQUE"));
    expect(withoutTech).toContain(hex("1. FINDINGS"));
  });
});

// ── Referral tagline toggle ────────────────────────────────────────────────

describe("referral tagline toggle", () => {
  test("on (default) — the tagline prints", () => {
    const html = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport());
    expect(html).toContain("Thanks For Your Referral.");
  });

  test("off — no tagline, not even an empty paragraph", () => {
    const html = buildUsgReportHtml({ ...BASE_SETTINGS, usgPrintShowThanks: false }, PATIENT, resolvedReport());
    expect(html).not.toContain("Thanks For Your Referral.");
    expect(html).not.toContain('class="thanks"');
  });
});

// ── One-page fit: tail grouping + tighter trailing gaps ─────────────────────

describe("signature never spills alone — the tail block", () => {
  test("signature + declaration + footer share one unbreakable tail", () => {
    const html = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport());
    expect(html).toContain(".tail { page-break-inside: avoid; }");
    const tailStart = html.indexOf('<div class="tail">');
    expect(tailStart).toBeGreaterThan(0);
    const tail = html.slice(tailStart);
    expect(tail).toContain('class="sig-block"');
    expect(tail).toContain('class="declaration"');
    expect(tail).toContain('class="footer"');
  });

  test("default trailing gaps are the tighter v6.2 values", () => {
    const html = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport());
    expect(html).toContain(".sig-block { margin-top: 16px;");
    expect(html).not.toContain(".sig-block { margin-top: 30px;");
  });
});

// ── Section spacing presets ────────────────────────────────────────────────

describe("section spacing presets", () => {
  test("tight compresses the gaps; relaxed airs them out", () => {
    const tight = buildUsgReportHtml({ ...BASE_SETTINGS, usgPrintSpacing: "tight" }, PATIENT, resolvedReport());
    expect(tight).toContain(".sig-block { margin-top: 10px; }");
    expect(tight).toContain("h2.band { margin-top: 8px; margin-bottom: 5px; }");
    const relaxed = buildUsgReportHtml({ ...BASE_SETTINGS, usgPrintSpacing: "relaxed" }, PATIENT, resolvedReport());
    expect(relaxed).toContain(".sig-block { margin-top: 34px; }");
    expect(relaxed).toContain("h2.band { margin-top: 20px; margin-bottom: 11px; }");
  });

  test("normal (and unknown values) add no preset overrides", () => {
    const normal = buildUsgReportHtml(BASE_SETTINGS, PATIENT, resolvedReport());
    expect(normal).not.toContain(".sig-block { margin-top: 10px; }");
    expect(normal).not.toContain(".sig-block { margin-top: 34px; }");
    const weird = buildUsgReportHtml({ ...BASE_SETTINGS, usgPrintSpacing: "huge" }, PATIENT, resolvedReport());
    expect(weird).not.toContain(".sig-block { margin-top: 10px; }");
    expect(weird).not.toContain(".sig-block { margin-top: 34px; }");
  });
});

// ── A5 keeps its own proportions ────────────────────────────────────────────

describe("A5 interaction", () => {
  test("A5 keeps its tuned font sizes but honours line-height", () => {
    const html = buildUsgReportHtml(
      { ...BASE_SETTINGS, usgPrintPaper: "a5", usgPrintFontSize: 12, usgPrintLineHeight: 1.8 },
      PATIENT,
      resolvedReport(),
    );
    expect(html).toContain("@page { size: A5;");
    expect(html).not.toContain("body { font-size: 12pt;"); // no A4 body override on A5
    expect(html).toContain("body { line-height: 1.8; }");
  });
});

// ── Bill-desk blanking guard (careSync) ────────────────────────────────────

describe("blank ERP values never blank stored demographics", () => {
  const ROW: CareWorklistItem = {
    worklistId: "9100",
    accessionNumber: "",
    patientName: "Sital Jaiswal",
    patientAge: "26/F",
    patientPhone: "9800112233",
    referringDoctor: "Dr. Kumar",
    modality: "US",
    studyDate: "2026-09-01T00:00:00.000Z",
    studyInstanceUid: "1.2.276.0.26.1.1.1.2.2026.280.9100.9",
    billingStatus: null,
  };

  test("a resync sending blanks keeps the stored values", async () => {
    await importCareRows([ROW]);
    const blanked: CareWorklistItem = {
      ...ROW,
      patientAge: "",
      patientPhone: "",
      referringDoctor: "",
    };
    const stats = await importCareRows([blanked]);
    expect(stats.updatedExisting).toBe(1);
    const order = await db.usgCareOrder.findFirstOrThrow({ where: { careWorklistId: "9100" } });
    expect(order.patientAge).toBe("26");
    expect(order.patientPhone).toBe("9800112233");
    expect(order.referringDoctor).toBe("Dr. Kumar");
  });
});

// ── Patient-history fallback for age / referral doctor ──────────────────────

describe("latestKnownDemographics — repeat patients carry forward", () => {
  test("by registry link: the most recent report wins", async () => {
    const pid = await linkPatient("Rani Devi", "9800112233");
    await db.usgReport.create({
      data: { patientName: "Rani Devi", patientAge: "29", referredBy: "", patientId: pid, stateJson: "{}" },
    });
    await db.usgReport.create({
      data: { patientName: "Rani Devi", patientAge: "30", referredBy: "Dr. Kumar", patientId: pid, stateJson: "{}" },
    });
    const got = await latestKnownDemographics(pid, "Rani Devi");
    expect(got).toEqual({ age: "30", referredBy: "Dr. Kumar" });
  });

  test("by exact name when the patient link is null (legacy rows)", async () => {
    const pid = await linkPatient("Sital Jaiswal", "");
    await db.usgReport.create({
      data: { patientName: "Sital Jaiswal", patientAge: "26", referredBy: "Dr. Singh", patientId: pid, stateJson: "{}" },
    });
    const got = await latestKnownDemographics(null, "Sital Jaiswal");
    expect(got).toEqual({ age: "26", referredBy: "Dr. Singh" });
  });

  test("a different patient's history is never used", async () => {
    const other = await linkPatient("Sita Devi", "9800000000");
    await db.usgReport.create({
      data: { patientName: "Sita Devi", patientAge: "77", referredBy: "Dr. Stranger", patientId: other, stateJson: "{}" },
    });
    const got = await latestKnownDemographics(null, "Rani Devi");
    expect(got).toEqual({ age: "", referredBy: "" });
  });
});

// ── Settings persistence: the dials clamp on the Save path ─────────────────

describe("settings clamp the dials on save", () => {
  test("font size clamps to 8.5–13; line-height to 1.15–1.9; spacing normalises", async () => {
    await updateSettings({
      usgPrintFontSize: "99",
      usgPrintLineHeight: "0.5",
      usgPrintSpacing: "huge",
      usgPrintShowTechnique: "off",
      usgPrintShowThanks: "false",
    });
    const s = await getSettings();
    expect(s.usgPrintFontSize).toBe(13);
    expect(s.usgPrintLineHeight).toBe(1.15);
    expect(s.usgPrintSpacing).toBe("normal");
    expect(s.usgPrintShowTechnique).toBe(false);
    expect(s.usgPrintShowThanks).toBe(false);
  });

  test("legitimate dial values persist exactly", async () => {
    await updateSettings({ usgPrintFontSize: "9", usgPrintLineHeight: "1.35", usgPrintSpacing: "tight", usgPrintShowTechnique: "on" });
    const s = await getSettings();
    expect(s.usgPrintFontSize).toBe(9);
    expect(s.usgPrintLineHeight).toBe(1.35);
    expect(s.usgPrintSpacing).toBe("tight");
    expect(s.usgPrintShowTechnique).toBe(true);
  });

  test("numeric payloads (the slider's JSON body) persist too", async () => {
    await updateSettings({ usgPrintFontSize: 11.5, usgPrintLineHeight: 1.6 });
    const s = await getSettings();
    expect(s.usgPrintFontSize).toBe(11.5);
    expect(s.usgPrintLineHeight).toBe(1.6);
  });

  test("a fresh install ships the v6.2 one-page defaults", async () => {
    const s = await getSettings();
    expect(s.usgPrintFontSize).toBe(10);
    expect(s.usgPrintLineHeight).toBe(1.4);
    expect(s.usgPrintSpacing).toBe("tight");
    expect(s.usgPrintShowTechnique).toBe(true);
    expect(s.usgPrintShowThanks).toBe(true);
  });
});

// ── helpers ────────────────────────────────────────────────────────────────

async function pdfText(bytesPromise: Promise<Uint8Array>): Promise<string> {
  const bytes = await bytesPromise;
  const loaded = await PDFDocument.load(bytes);
  let out = "";
  for (const [, obj] of loaded.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      try {
        out += Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1");
      } catch {
        // non-decodable stream — skip
      }
    }
  }
  return out;
}

const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toUpperCase();

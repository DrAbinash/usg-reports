/**
 * Sentence-level bold for abnormal findings — only the disease claim is bold.
 */
import { describe, expect, test } from "vitest";
import {
  formatFindingsBodyHtml,
  isBaselineFindingSentence,
  isNeutralMeasurementSentence,
  segmentAbnormalFindings,
} from "../src/lib/usg/abnormalBold";
import { applyPathology, makeLookup, resolve } from "../src/lib/usg/composer";
import { initialState, LIVER_N } from "../src/lib/usg/studies";
import { USG_PATHOLOGIES_ALL } from "../src/lib/usg/pathologies";
import { buildUsgReportHtml, type UsgPrintSettings } from "../src/lib/usg/print";

const lookup = makeLookup(USG_PATHOLOGIES_ALL);

const SETTINGS = {
  hospitalName: "CARE Diagnostics",
  addressLine: "Subhash Chowk, Deoghar",
  phone: "06432-123456",
  email: "care@example.com",
  usgDoctorName: "Dr. Sugandha",
  usgDoctorQual: "MBBS, MD",
  usgDoctorRegNo: "J/12345",
  usgPrintStyle: "classic",
  usgLogoSizeMm: 14,
} as UsgPrintSettings;

describe("isNeutralMeasurementSentence", () => {
  test("plain measure lines are neutral", () => {
    expect(isNeutralMeasurementSentence("Liver measures in mid-clavicular line 14 cm.")).toBe(true);
    expect(isNeutralMeasurementSentence("It measures 1.0 cm.")).toBe(true);
  });
  test("enlarged / fatty measure lines are not neutral", () => {
    expect(
      isNeutralMeasurementSentence("Liver is enlarged in size and measures in mid-clavicular line 16 cm."),
    ).toBe(false);
  });
});

describe("isBaselineFindingSentence vs liver normal", () => {
  test("scaffold sentences from LIVER_N are baseline", () => {
    expect(isBaselineFindingSentence("No masses or focal pathology is noted.", LIVER_N)).toBe(true);
    expect(isBaselineFindingSentence("Intrahepatic biliary channels are not dilated.", LIVER_N)).toBe(true);
    expect(isBaselineFindingSentence("The portal vein is normal in appearance.", LIVER_N)).toBe(true);
  });
  test("fatty-change claim is not baseline", () => {
    expect(
      isBaselineFindingSentence(
        "Appears normal in morphology with mildly increased hepatic parenchymal echogenicity (Grade I Fatty Changes).",
        LIVER_N,
      ),
    ).toBe(false);
  });
});

describe("formatFindingsBodyHtml — fatty liver", () => {
  test("only the Grade I fatty sentence is wrapped in <strong>", () => {
    const text =
      "Liver measures in mid-clavicular line ___ cm. Appears normal in morphology with mildly increased hepatic parenchymal echogenicity (Grade I Fatty Changes). No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance. It measures ___ cm.";
    const html = formatFindingsBodyHtml(text, { abnormal: true, normalText: LIVER_N });
    expect(html).toContain("Liver measures in mid-clavicular line ___ cm.");
    expect(html).not.toMatch(/<strong>Liver measures/);
    expect(html).toMatch(
      /<strong>Appears normal in morphology with mildly increased hepatic parenchymal echogenicity \(Grade I Fatty Changes\)\.<\/strong>/,
    );
    expect(html).toContain("No masses or focal pathology is noted.");
    expect(html).not.toMatch(/<strong>No masses/);
    expect(html).not.toMatch(/<strong>It measures/);
    // Whole block must not be one giant strong.
    expect(html.startsWith("<strong>")).toBe(false);
  });

  test("decimal measurements stay in one sentence and are not bold", () => {
    const text =
      "Liver measures in mid-clavicular line 14.8 cm. Appears normal in morphology with mildly increased hepatic parenchymal echogenicity (Grade I Fatty Changes). No masses or focal pathology is noted.";
    const html = formatFindingsBodyHtml(text, { abnormal: true, normalText: LIVER_N });
    expect(html).toContain("Liver measures in mid-clavicular line 14.8 cm.");
    expect(html).not.toMatch(/<strong>Liver measures/);
    expect(html).not.toMatch(/<strong>8 cm/);
    expect(html).toMatch(/<strong>[^<]*Grade I Fatty Changes[^<]*<\/strong>/);
  });

  test("dotted abbreviations like S.O.L stay in one scaffold sentence", () => {
    const text =
      "Spleen is enlarged in size. Appears normal in morphology and parenchymal echogenicity. No evidence of focal lesion or S.O.L seen. No evidence of splenic collateral vessels.";
    const html = formatFindingsBodyHtml(text, {
      abnormal: true,
      normalText:
        "Spleen appears normal in morphology and parenchymal echogenicity. No evidence of focal lesion or S.O.L seen. No evidence of splenic collateral vessels.",
    });
    expect(html).toContain("No evidence of focal lesion or S.O.L seen.");
    expect(html).not.toMatch(/<strong>No evidence of focal lesion/);
    expect(html).not.toMatch(/<strong>L seen/);
    expect(html).toMatch(/<strong>Spleen is enlarged in size\.<\/strong>/);
  });

  test("normal organ — no strong tags", () => {
    const html = formatFindingsBodyHtml(LIVER_N, { abnormal: false, normalText: LIVER_N });
    expect(html).not.toContain("<strong>");
  });
});

describe("print HTML — every abnormal organ (not liver-only)", () => {
  const patient = {
    name: "Rani Devi",
    age: "30",
    sex: "F",
    referredBy: "Dr. Kumar",
    date: "01-Sep-2026",
    serial: "USG-0001",
  };

  test("LIVER — label/measure plain; fatty claim bold", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const html = buildUsgReportHtml(
      SETTINGS,
      patient,
      resolve(state, lookup, "Routine transabdominal scan."),
    );
    expect(html).toMatch(/<th>LIVER<\/th>/);
    expect(html).not.toMatch(/<th><strong>LIVER<\/strong><\/th>/);
    expect(html).not.toMatch(/<strong>Liver measures/);
    expect(html).toMatch(/<strong>[^<]*Grade I Fatty Changes[^<]*<\/strong>/);
    expect(html).not.toMatch(
      /<td><strong>Liver measures in mid-clavicular line[\s\S]*It measures ___ cm\.<\/strong><\/td>/,
    );
  });

  test("G.B. — scaffold plain; calculus sentence bold", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "gb", "gb-calculus", lookup);
    const html = buildUsgReportHtml(
      SETTINGS,
      patient,
      resolve(state, lookup, "Routine transabdominal scan."),
    );
    expect(html).toMatch(/<th>G\. B<\/th>/);
    expect(html).not.toMatch(/<th><strong>G\. B<\/strong><\/th>/);
    // Opening scaffold stays regular.
    expect(html).toMatch(
      /<td>Gall bladder is normal in physiological distension\. <strong>/,
    );
    expect(html).toMatch(/<strong>[^<]*suggestive of calculus[^<]*<\/strong>/);
    expect(html).not.toMatch(/<strong>Wall thickness is normal/);
    expect(html).not.toMatch(
      /<td><strong>Gall bladder is normal in physiological distension[\s\S]*Murphy/,
    );
  });

  test("SPLEEN — enlarged claim bold; normal morphology / no SOL plain", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "spleen", "spleen-splenomegaly", lookup);
    const html = buildUsgReportHtml(
      SETTINGS,
      patient,
      resolve(state, lookup, "Routine transabdominal scan."),
    );
    expect(html).toMatch(/<th>SPLEEN<\/th>/);
    expect(html).not.toMatch(/<th><strong>SPLEEN<\/strong><\/th>/);
    expect(html).toMatch(/<strong>[^<]*Spleen is enlarged[^<]*<\/strong>/);
    expect(html).not.toMatch(/<strong>Appears normal in morphology/);
    expect(html).not.toMatch(/<strong>No evidence of focal lesion/);
  });

  test("multi-organ report — each organ bolds only its own abnormal sentences", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    state = applyPathology(state, "gb", "gb-calculus", lookup);
    state = applyPathology(state, "spleen", "spleen-splenomegaly-nosize", lookup);
    const html = buildUsgReportHtml(
      SETTINGS,
      patient,
      resolve(state, lookup, "Routine transabdominal scan."),
    );
    expect(html).toMatch(/<strong>[^<]*Grade I Fatty Changes[^<]*<\/strong>/);
    expect(html).toMatch(/<strong>[^<]*suggestive of calculus[^<]*<\/strong>/);
    expect(html).toMatch(/<strong>[^<]*Spleen is enlarged[^<]*<\/strong>/);
    // No whole-organ strong wrappers.
    expect(html).not.toMatch(/<th><strong>/);
    expect(html).not.toMatch(/<strong>Liver measures/);
    expect(html).not.toMatch(/<strong>Gall bladder is normal in physiological distension/);
  });
});

describe("segmentAbnormalFindings", () => {
  test("marks only disease sentences bold", () => {
    const segs = segmentAbnormalFindings(
      "Liver measures 14 cm. Shows Grade II fatty changes. No masses or focal pathology is noted.",
      LIVER_N,
    );
    const bold = segs.filter((s) => s.bold).map((s) => s.text.trim());
    const plain = segs.filter((s) => !s.bold).map((s) => s.text.trim());
    expect(bold.some((t) => /Grade II fatty/i.test(t))).toBe(true);
    expect(plain.some((t) => /Liver measures/i.test(t))).toBe(true);
    expect(plain.some((t) => /No masses/i.test(t))).toBe(true);
  });
});

/**
 * Unit tests for billing-desk → study-type resolution (source #1 on study open).
 */
import { describe, expect, test } from "vitest";
import {
  DEFAULT_BILLING_PROCEDURE_MAP,
  resolveBilledStudyType,
  resolveNormalBootstrapFormat,
  studyKeyForStudyType,
} from "../src/lib/usg/billedStudyType";
import { BUILTIN_NP_TEMPLATES } from "../src/lib/usg/npTemplates";
import { careTestCode, careTestName } from "../src/lib/usg/careClient";

describe("resolveBilledStudyType", () => {
  test("null / blank → null (no billed row → DICOM/manual fallback)", () => {
    expect(resolveBilledStudyType(null)).toBeNull();
    expect(resolveBilledStudyType("")).toBeNull();
    expect(resolveBilledStudyType("   ")).toBeNull();
  });

  test("default map: whole abdomen / KUB / TVS / OB", () => {
    expect(resolveBilledStudyType("USG WHOLE ABDOMEN")).toBe("whole-abdomen");
    expect(resolveBilledStudyType("usg whole abdomen")).toBe("whole-abdomen");
    expect(resolveBilledStudyType("UPPER ABDOMEN")).toBe("upper-abdomen");
    expect(resolveBilledStudyType("KUB")).toBe("kub");
    expect(resolveBilledStudyType("TVS")).toBe("tvs");
    expect(resolveBilledStudyType("LOWER ABDOMEN")).toBe("lower-abdomen");
    expect(resolveBilledStudyType("OB")).toBe("ob");
    expect(resolveBilledStudyType("OBSTETRIC")).toBe("ob");
  });

  test("ECHO family → study type echo (seeded Echo template)", () => {
    expect(resolveBilledStudyType("ECHO")).toBe("echo");
    expect(resolveBilledStudyType("2D ECHO")).toBe("echo");
    expect(resolveBilledStudyType("ECHOCARDIOGRAPHY")).toBe("echo");
    expect(resolveBilledStudyType("2D Echo / Colour Doppler")).toBe("echo");
    expect(resolveBilledStudyType("CARDIAC")).toBe("echo");
  });

  test("unknown / non-USG string → unmapped (never whole-abdomen)", () => {
    expect(resolveBilledStudyType("something unknown")).toBe("unmapped");
    expect(resolveBilledStudyType("TMT")).toBe("unmapped");
    expect(resolveBilledStudyType("CT BRAIN")).toBe("unmapped");
    expect(resolveBilledStudyType("MRI Knee")).toBe("unmapped");
  });

  test("settings override wins over defaults (incl. new echo rows)", () => {
    expect(
      resolveBilledStudyType("ECHO", { ECHO: "whole-abdomen" }),
    ).toBe("whole-abdomen");
    expect(
      resolveBilledStudyType("ECHO", { ECHO: "unmapped" }),
    ).toBe("unmapped");
    expect(
      resolveBilledStudyType("CUSTOM PROC", { "CUSTOM PROC": "kub" }),
    ).toBe("kub");
  });

  test("default map exposes the shipped keys", () => {
    expect(DEFAULT_BILLING_PROCEDURE_MAP.ECHO).toBe("echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["2D ECHO"]).toBe("echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP.ECHOCARDIOGRAPHY).toBe("echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP.CARDIAC).toBe("echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["USG WHOLE ABDOMEN"]).toBe("whole-abdomen");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["USG W"]).toBe("whole-abdomen");
  });

  test("bill-desk catalog codes from test-catalog CSV", () => {
    // Adult ECHO — code alone (name blank) must NOT fall through to WA.
    expect(resolveBilledStudyType({ testCode: "ECHO", testName: null })).toBe("echo");
    expect(resolveBilledStudyType({ testCode: "ECHO", testName: "" })).toBe("echo");
    expect(resolveBilledStudyType({ testCode: "ECHO", testName: "ECHO" })).toBe("echo");
    // Whole abdomen catalog code.
    expect(resolveBilledStudyType({ testCode: "USG W", testName: "USG WHOLE ABDOMEN" })).toBe(
      "whole-abdomen",
    );
    expect(resolveBilledStudyType({ testCode: "USG W", testName: null })).toBe("whole-abdomen");
    // Fetal echo has its OWN Fetal Echo format (owner decision 2026-09-29).
    expect(resolveBilledStudyType({ testCode: "USGFE", testName: "USG FETAL ECHO" })).toBe("fetal-echo");
    expect(resolveBilledStudyType("USG FETAL ECHO")).toBe("fetal-echo");
    // Fetal DOPPLER rows still resolve obstetric — unchanged path.
    expect(resolveBilledStudyType({ testCode: "FETALDOPPLER", testName: null })).toBe("ob");
    expect(resolveBilledStudyType("USG FETAL DOPPLER")).toBe("ob");
    // Code wins over a misleading/blank name path.
    expect(resolveBilledStudyType({ testCode: "ECHO", testName: "USG" })).toBe("echo");
  });

  test("careTestCode / careTestName accept ERP aliases", () => {
    expect(careTestCode({ testCode: "ECHO" })).toBe("ECHO");
    expect(careTestCode({ testId: "ECHO" })).toBe("ECHO");
    expect(careTestCode({ testId: 42 })).toBe("42");
    expect(careTestCode({ billedTestCode: "USG W" })).toBe("USG W");
    expect(careTestName({ testName: "", billedTestName: "ECHO" })).toBe("ECHO");
    expect(careTestName({ testName: "ECHO", billedTestName: "ignored" })).toBe("ECHO");
  });
});

describe("fetal-echo study type (owner decision 2026-09-29)", () => {
  test("billed fetal-echo rows → fetal-echo, never echo / ob", () => {
    expect(resolveBilledStudyType("ECHO FETAL")).toBe("fetal-echo");
    expect(resolveBilledStudyType("FETAL ECHO")).toBe("fetal-echo");
    expect(resolveBilledStudyType("USG FETAL ECHO")).toBe("fetal-echo");
    expect(resolveBilledStudyType("USGFE")).toBe("fetal-echo");
    expect(resolveBilledStudyType({ testCode: "USGFE", testName: null })).toBe("fetal-echo");
    // Heuristic path (fuzzy, not exact dictionary key).
    expect(resolveBilledStudyType("Fetal Echocardiography")).toBe("fetal-echo");
    expect(resolveBilledStudyType({ testCode: "TRIAL2", testName: "ECHO FETAL" })).toBe("fetal-echo");
  });

  test("adult echo rows unchanged → echo", () => {
    expect(resolveBilledStudyType("ECHO")).toBe("echo");
    expect(resolveBilledStudyType("2D ECHO")).toBe("echo");
    expect(resolveBilledStudyType("CARDIAC")).toBe("echo");
  });

  test("ALL fetal DOPPLER keys stay ob", () => {
    expect(resolveBilledStudyType("FETALDOPPLER")).toBe("ob");
    expect(resolveBilledStudyType("USG FETAL DOPPLER")).toBe("ob");
    expect(resolveBilledStudyType("UFETALDT")).toBe("ob");
    expect(resolveBilledStudyType("USG FETAL DOPPLER (TWIN)")).toBe("ob");
    expect(resolveBilledStudyType({ testCode: "UFETALDT", testName: "USG FETAL DOPPLER (TWIN)" })).toBe("ob");
  });

  test("regression: whole abdomen untouched", () => {
    expect(resolveBilledStudyType("USG WHOLE ABDOMEN")).toBe("whole-abdomen");
    expect(resolveBilledStudyType("USG W")).toBe("whole-abdomen");
  });

  test("default map entries", () => {
    expect(DEFAULT_BILLING_PROCEDURE_MAP.USGFE).toBe("fetal-echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["USG FETAL ECHO"]).toBe("fetal-echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["ECHO FETAL"]).toBe("fetal-echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["FETAL ECHO"]).toBe("fetal-echo");
    expect(DEFAULT_BILLING_PROCEDURE_MAP["USG FETAL DOPPLER"]).toBe("ob");
  });

  test("studyKeyForStudyType('fetal-echo') === 'fetal-echo' (sex-independent)", () => {
    expect(studyKeyForStudyType("fetal-echo")).toBe("fetal-echo");
    expect(studyKeyForStudyType("fetal-echo", "F")).toBe("fetal-echo");
    expect(studyKeyForStudyType("fetal-echo", "M")).toBe("fetal-echo");
    expect(studyKeyForStudyType("fetal-echo", "", true)).toBe("fetal-echo");
  });
});

describe("studyKeyForStudyType + resolveNormalBootstrapFormat", () => {
  test("sex-aware whole / lower abdomen keys", () => {
    expect(studyKeyForStudyType("whole-abdomen", "F")).toBe("wa-female");
    expect(studyKeyForStudyType("whole-abdomen", "M")).toBe("wa-male");
    expect(studyKeyForStudyType("whole-abdomen", "F", true)).toBe("wa-child");
    expect(studyKeyForStudyType("lower-abdomen", "M")).toBe("la-male");
  });

  test("billed ECHO / 2D ECHO / ECHOCARDIOGRAPHY → Echo template, no banner", () => {
    const echoSeeds = BUILTIN_NP_TEMPLATES.filter((t) => t.studyKey === "echo");
    expect(echoSeeds).toHaveLength(1);
    expect(echoSeeds[0]!.name).toBe("Echo (2D Echocardiography)");

    for (const proc of ["ECHO", "2D ECHO", "ECHOCARDIOGRAPHY"]) {
      const boot = resolveNormalBootstrapFormat({
        billedProcedure: proc,
        patientSex: "F",
      });
      expect(boot.kind, proc).toBe("mapped");
      if (boot.kind === "mapped") {
        expect(boot.studyType).toBe("echo");
        expect(boot.studyKey).toBe(echoSeeds[0]!.studyKey);
        expect(boot.npTemplateName).toBe(echoSeeds[0]!.name);
      }
    }
  });

  test("billed TMT / gibberish → unmapped + banner", () => {
    for (const proc of ["TMT", "xyzzy-not-a-study"]) {
      const boot = resolveNormalBootstrapFormat({
        billedProcedure: proc,
        patientSex: "F",
      });
      expect(boot.kind, proc).toBe("unmapped");
      if (boot.kind === "unmapped") {
        expect(boot.banner).toContain(`Billed: ${proc}`);
        expect(boot.banner).toContain("no matching USG report format");
      }
    }
  });

  test("billed USG WHOLE ABDOMEN + female → NP Whole Abdomen — Female", () => {
    const boot = resolveNormalBootstrapFormat({
      billedProcedure: "USG WHOLE ABDOMEN",
      patientSex: "F",
    });
    expect(boot).toEqual({
      kind: "mapped",
      studyType: "whole-abdomen",
      studyKey: "wa-female",
      npTemplateName: "NP Whole Abdomen — Female",
    });
  });

  test("no billed row → kind none (DICOM/manual unchanged)", () => {
    expect(resolveNormalBootstrapFormat({ billedProcedure: null }).kind).toBe("none");
  });

  test("catalog ECHO code-only bootstrap → Echo template (not WA)", () => {
    const boot = resolveNormalBootstrapFormat({
      testCode: "ECHO",
      testName: null,
      patientSex: "M",
    });
    expect(boot).toEqual({
      kind: "mapped",
      studyType: "echo",
      studyKey: "echo",
      npTemplateName: "Echo (2D Echocardiography)",
    });
  });
});

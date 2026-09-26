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
});

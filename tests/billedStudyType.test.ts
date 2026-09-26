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

  test("ECHO family → unmapped (no USG format)", () => {
    expect(resolveBilledStudyType("ECHO")).toBe("unmapped");
    expect(resolveBilledStudyType("2D ECHO")).toBe("unmapped");
    expect(resolveBilledStudyType("ECHOCARDIOGRAPHY")).toBe("unmapped");
    expect(resolveBilledStudyType("2D Echo / Colour Doppler")).toBe("unmapped");
  });

  test("unknown string → unmapped (never whole-abdomen)", () => {
    expect(resolveBilledStudyType("something unknown")).toBe("unmapped");
    expect(resolveBilledStudyType("CT BRAIN")).toBe("unmapped");
    expect(resolveBilledStudyType("MRI Knee")).toBe("unmapped");
  });

  test("settings override wins over defaults", () => {
    expect(
      resolveBilledStudyType("ECHO", { ECHO: "whole-abdomen" }),
    ).toBe("whole-abdomen");
    expect(
      resolveBilledStudyType("CUSTOM PROC", { "CUSTOM PROC": "kub" }),
    ).toBe("kub");
  });

  test("default map exposes the shipped keys", () => {
    expect(DEFAULT_BILLING_PROCEDURE_MAP.ECHO).toBe("unmapped");
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

  test("billed ECHO → unmapped bootstrap (banner, no format)", () => {
    const boot = resolveNormalBootstrapFormat({
      billedProcedure: "ECHO",
      patientSex: "F",
    });
    expect(boot.kind).toBe("unmapped");
    if (boot.kind === "unmapped") {
      expect(boot.banner).toContain("Billed: ECHO");
      expect(boot.banner).toContain("no matching USG report format");
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

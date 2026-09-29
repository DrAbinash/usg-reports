/**
 * Bootstrap integration — billing drives format selection on study open.
 * Exercises the pure bootstrap resolver used by worklist Start + composer.
 */
import { describe, expect, test } from "vitest";
import { resolveNormalBootstrapFormat } from "../src/lib/usg/billedStudyType";
import { getStudy, initialState } from "../src/lib/usg/studies";
import { normaliseState } from "../src/lib/usg/composer";

/** Mirror of the start-route decision: apply format only when mapped. */
function bootstrapComposerState(ctx: {
  billedProcedure?: string | null;
  testCode?: string | null;
  testName?: string | null;
  patientSex?: string;
  child?: boolean;
}) {
  const boot = resolveNormalBootstrapFormat(ctx);
  if (boot.kind === "unmapped") {
    return {
      boot,
      state: { studyKey: "", organs: [] as ReturnType<typeof initialState>["organs"], impressionOverride: null },
      formatApplied: false as const,
      banner: boot.banner,
    };
  }
  if (boot.kind === "none") {
    // Existing DICOM / manual fallback — sexed whole abdomen when nothing billed.
    const studyKey = ctx.child ? "wa-child" : ctx.patientSex === "M" ? "wa-male" : "wa-female";
    return {
      boot,
      state: normaliseState({}, studyKey),
      formatApplied: true as const,
      banner: null,
    };
  }
  return {
    boot,
    state: normaliseState({}, boot.studyKey),
    formatApplied: true as const,
    banner: null,
  };
}

describe("billed study bootstrap integration", () => {
  test("billed ECHO → Echo format applied, no amber banner", () => {
    const r = bootstrapComposerState({ billedProcedure: "ECHO", patientSex: "M" });
    expect(r.formatApplied).toBe(true);
    expect(r.banner).toBeNull();
    expect(r.boot.kind).toBe("mapped");
    if (r.boot.kind === "mapped") {
      expect(r.boot.studyType).toBe("echo");
      expect(r.boot.studyKey).toBe("echo");
      expect(r.boot.npTemplateName).toBe("Echo — Adult M-Mode");
    }
    expect(r.state.studyKey).toBe("echo");
    expect(r.state.organs.length).toBeGreaterThan(0);
    expect(r.state.organs.some((o) => o.organ === "echo-mmode" || o.organ === "echo-valves")).toBe(true);
    expect(getStudy(r.state.studyKey)?.title).toMatch(/ECHO|ECHOCARDIOGRAPHY/i);
  });

  test("catalog ECHO code with blank name → Echo (never whole abdomen)", () => {
    const r = bootstrapComposerState({ testCode: "ECHO", testName: null, patientSex: "F" });
    expect(r.formatApplied).toBe(true);
    expect(r.banner).toBeNull();
    expect(r.state.studyKey).toBe("echo");
    expect(r.state.studyKey).not.toMatch(/^wa-/);
  });

  test("billed 2D ECHO / ECHOCARDIOGRAPHY → same Echo canvas, banner false", () => {
    for (const proc of ["2D ECHO", "ECHOCARDIOGRAPHY"]) {
      const r = bootstrapComposerState({ billedProcedure: proc, patientSex: "F" });
      expect(r.formatApplied, proc).toBe(true);
      expect(r.banner, proc).toBeNull();
      expect(r.state.studyKey, proc).toBe("echo");
    }
  });

  test("billed ECHO FETAL / USGFE + empty editor → Fetal Echo format applied", () => {
    for (const ctx of [
      { billedProcedure: "ECHO FETAL", patientSex: "F" },
      { testCode: "USGFE", testName: "USG FETAL ECHO", patientSex: "F" },
      { billedProcedure: "FETAL ECHO", patientSex: "" },
    ]) {
      const proc = ctx.billedProcedure ?? `${ctx.testCode} ${ctx.testName}`;
      const r = bootstrapComposerState(ctx);
      expect(r.formatApplied, proc).toBe(true);
      expect(r.banner, proc).toBeNull();
      expect(r.boot.kind, proc).toBe("mapped");
      if (r.boot.kind === "mapped") {
        expect(r.boot.studyType, proc).toBe("fetal-echo");
        expect(r.boot.studyKey, proc).toBe("fetal-echo");
        expect(r.boot.npTemplateName, proc).toBe("USG Fetal Echocardiography");
      }
      expect(r.state.studyKey, proc).toBe("fetal-echo");
      expect(r.state.studyKey, proc).not.toBe("echo");
      expect(r.state.studyKey, proc).not.toBe("ob");
      expect(r.state.organs.length, proc).toBeGreaterThan(0);
      expect(
        r.state.organs.some((o) => o.organ === "fetal-echo-situs" || o.organ === "fetal-echo-four-chamber"),
        proc,
      ).toBe(true);
      expect(getStudy(r.state.studyKey)?.title, proc).toMatch(/FETAL ECHOCARDIOGRAPHY/i);
    }
  });

  test("billed ECHO → adult Echo format (not fetal-echo); billed growth → ob format", () => {
    const adult = bootstrapComposerState({ billedProcedure: "ECHO", patientSex: "M" });
    expect(adult.state.studyKey).toBe("echo");
    const growth = bootstrapComposerState({ billedProcedure: "USG GROWTH SCAN", patientSex: "F" });
    expect(growth.boot.kind).toBe("mapped");
    if (growth.boot.kind === "mapped") expect(growth.boot.studyKey).toBe("ob");
    const doppler = bootstrapComposerState({ testCode: "UFETALDT", testName: "USG FETAL DOPPLER (TWIN)", patientSex: "F" });
    expect(doppler.boot.kind).toBe("mapped");
    if (doppler.boot.kind === "mapped") expect(doppler.boot.studyKey).toBe("ob");
  });

  test("billed USG WHOLE ABDOMEN + female → NP Whole Abdomen — Female applied", () => {
    const r = bootstrapComposerState({
      billedProcedure: "USG WHOLE ABDOMEN",
      patientSex: "F",
    });
    expect(r.formatApplied).toBe(true);
    expect(r.banner).toBeNull();
    expect(r.boot.kind).toBe("mapped");
    if (r.boot.kind === "mapped") {
      expect(r.boot.studyKey).toBe("wa-female");
      expect(r.boot.npTemplateName).toBe("NP Whole Abdomen — Female");
    }
    expect(r.state.studyKey).toBe("wa-female");
    expect(r.state.organs.length).toBeGreaterThan(0);
    expect(r.state.organs.some((o) => o.organ === "liver")).toBe(true);
    expect(getStudy(r.state.studyKey)?.title).toMatch(/WHOLE ABDOMEN/i);
  });

  test("no billed row → existing DICOM fallback (sexed whole abdomen) unchanged", () => {
    const female = bootstrapComposerState({ billedProcedure: null, patientSex: "F" });
    expect(female.boot.kind).toBe("none");
    expect(female.formatApplied).toBe(true);
    expect(female.state.studyKey).toBe("wa-female");

    const male = bootstrapComposerState({ billedProcedure: null, patientSex: "M" });
    expect(male.state.studyKey).toBe("wa-male");
  });

  test("genuinely unmapped bills → empty canvas + banner (never WA)", () => {
    for (const proc of ["TMT", "CT PNS", "xyzzy-not-a-study"]) {
      const r = bootstrapComposerState({ billedProcedure: proc, patientSex: "F" });
      expect(r.state.studyKey, proc).toBe("");
      expect(r.state.studyKey, proc).not.toMatch(/^wa-/);
      expect(r.formatApplied, proc).toBe(false);
      expect(r.banner, proc).toMatch(/no matching USG report format/);
    }
  });
});

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
  billedProcedure: string | null;
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
  test("billed ECHO → NO format applied + banner flag set", () => {
    const r = bootstrapComposerState({ billedProcedure: "ECHO", patientSex: "M" });
    expect(r.formatApplied).toBe(false);
    expect(r.banner).toMatch(/Billed: ECHO/);
    expect(r.state.studyKey).toBe("");
    expect(r.state.organs).toEqual([]);
    expect(getStudy(r.state.studyKey)).toBeUndefined();
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

  test("never defaults to whole-abdomen when a billed unmapped row exists", () => {
    for (const proc of ["ECHO", "2D ECHO", "ECHOCARDIOGRAPHY", "CT PNS"]) {
      const r = bootstrapComposerState({ billedProcedure: proc, patientSex: "F" });
      expect(r.state.studyKey, proc).not.toMatch(/^wa-/);
      expect(r.formatApplied, proc).toBe(false);
    }
  });
});

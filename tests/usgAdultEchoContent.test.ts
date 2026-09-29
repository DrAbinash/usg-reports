/**
 * Adult 2D Echo content tests — M-Mode variable mapping extended from the
 * signed clinic reports (VSD ADULT / ASD right atrium / AS WITH MS MILD /
 * CHILD ASD 1 ECHO), the four new adult chips on the echo organs, and the
 * contradiction removals that whole-organ text replacement must guarantee.
 */
import { describe, expect, test } from "vitest";
import { initialState, getStudy, ECHO_MMODE_N, ECHO_VALVES_N, ECHO_OTHERS_N } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL, getPathologyAny } from "@/lib/usg/pathologies";
import {
  applyPathology,
  makeLookup,
  pathologiesForOrgan,
  resolve,
  setOrganVar,
} from "@/lib/usg/composer";

const lookupAll = makeLookup(USG_PATHOLOGIES_ALL);

function withPathology(studyKey: string, organ: string, pathology: string) {
  return applyPathology(initialState(studyKey), organ, pathology, lookupAll);
}

const organText = (studyKey: string, organ: string, pathology?: string) => {
  const state = pathology ? withPathology(studyKey, organ, pathology) : initialState(studyKey);
  return resolve(state, lookupAll, "t").sections.find((s) => s.organ === organ)!.text;
};

describe("Adult echo normal baseline (verbatim from clinic reports)", () => {
  test("echo-valves and echo-others resolve to the exact verbatim scaffold text", () => {
    expect(organText("echo", "echo-valves")).toBe(ECHO_VALVES_N);
    expect(organText("echo", "echo-others")).toBe(ECHO_OTHERS_N);
    // Sanity on the verbatim source strings themselves.
    expect(ECHO_VALVES_N).toContain("IVS ( Interventricular Septum ) : Intact.");
    expect(ECHO_VALVES_N).toContain("Pericardium : No effusion.");
    expect(ECHO_OTHERS_N).toContain("Normal pulmonary trunk & its branches.");
  });

  test("M-mode card carries the 13 report parameters incl. AoEx, IVS(s), PW(s) with normal ranges", () => {
    const lines = ECHO_MMODE_N.split("\n");
    expect(lines.length).toBe(13);
    for (const frag of [
      "AoEx ( Mean Aortic Cusps Diameter ) : {aoex} mm ( Normal 15 - 25 mm )",
      "IVS (s) ( Interventricular Septum in Systole ) : {ivss} mm ( Normal 6 - 14 mm )",
      "PW (s) ( Posterior Wall in Systole ) : {pws} mm ( Normal 6 - 14 mm )",
      "LVEF ( LV Ejection Fraction ) : {lvef} %",
    ]) {
      expect(ECHO_MMODE_N).toContain(frag);
    }
    // Every M-mode token has a declared var on the echo-mmode organ card.
    const def = getStudy("echo")!.organs.find((o) => o.key === "echo-mmode")!;
    const declared = new Set((def.vars ?? []).map((v) => v.key));
    for (const m of ECHO_MMODE_N.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
      expect(declared.has(m[1])).toBe(true);
    }
  });
});

describe("M-Mode measurement typing updates the prose", () => {
  test("typing 54 into LVEF renders 'LVEF ( LV Ejection Fraction ) : 54 %'", () => {
    let state = initialState("echo");
    state = setOrganVar(state, "echo-mmode", "lvef", "54");
    const r = resolve(state, lookupAll, "t");
    expect(r.sections.find((s) => s.organ === "echo-mmode")!.text).toContain(
      "LVEF ( LV Ejection Fraction ) : 54 %",
    );
  });

  test("AoEx / IVS(s) / PW(s) fields substitute like the rest of the table", () => {
    let state = initialState("echo");
    state = setOrganVar(state, "echo-mmode", "aoex", "17");
    state = setOrganVar(state, "echo-mmode", "ivss", "12");
    state = setOrganVar(state, "echo-mmode", "pws", "14");
    const text = resolve(state, lookupAll, "t").sections.find((s) => s.organ === "echo-mmode")!.text;
    expect(text).toContain("AoEx ( Mean Aortic Cusps Diameter ) : 17 mm ( Normal 15 - 25 mm )");
    expect(text).toContain("IVS (s) ( Interventricular Septum in Systole ) : 12 mm");
    expect(text).toContain("PW (s) ( Posterior Wall in Systole ) : 14 mm");
    // Untyped rows stay fill-in blanks — no stray tokens survive.
    expect(text).toContain("LA ( Left Atrial Diameter ) : ___ mm");
    expect(text).not.toMatch(/\{[a-z]+\}/);
  });
});

describe("Adult pathology chips on echo-valves (whole-organ replacement)", () => {
  test("new chips are registered on their organs", () => {
    const valves = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "echo-valves").map((p) => p.key);
    const others = pathologiesForOrgan(USG_PATHOLOGIES_ALL, "echo-others").map((p) => p.key);
    expect(valves).toEqual(
      expect.arrayContaining(["echo-vsd-valves", "echo-asd-valves", "echo-rhd-ms-as", "echo-pericardial-effusion"]),
    );
    expect(others).toEqual(expect.arrayContaining(["echo-pah"]));
  });

  test("VSD chip: normal 'IVS … Intact' is removed, defect line + gradient vars inserted", () => {
    let state = withPathology("echo", "echo-valves", "echo-vsd-valves");
    state = setOrganVar(state, "echo-valves", "vsd", "0.33");
    state = setOrganVar(state, "echo-valves", "pg", "54.6");
    state = setOrganVar(state, "echo-valves", "size", "small");
    const r = resolve(state, lookupAll, "t");
    const text = r.sections.find((s) => s.organ === "echo-valves")!.text;
    expect(text).not.toContain("IVS ( Interventricular Septum ) : Intact.");
    expect(text).toContain("IVS ( Interventricular Septum ) : Defect (0.33 cm ). Pg-54.6 mmHg.");
    expect(text).toContain("IAS ( Interatrial Septum ) : Intact."); // still normal
    expect(r.impression).toContain("A small perimembranous ventricular septal defect.");
    expect(r.impression).toContain("No chamber dilatation.");
    expect(r.advice.some((l) => /clinico-pathological/i.test(l))).toBe(true);
  });

  test("ASD chip: 'IAS … Intact' and normal RA/RV are removed; primum ASD + dilated RA/RV inserted", () => {
    let state = withPathology("echo", "echo-valves", "echo-asd-valves");
    state = setOrganVar(state, "echo-valves", "asd", "1.7");
    state = setOrganVar(state, "echo-valves", "pg", "4.4");
    state = setOrganVar(state, "echo-valves", "size", "small");
    const r = resolve(state, lookupAll, "t");
    const text = r.sections.find((s) => s.organ === "echo-valves")!.text;
    expect(text).not.toContain("IAS ( Interatrial Septum ) : Intact.");
    expect(text).toContain(
      "IAS ( Interatrial Septum ) : A small ostium primum ASD measuring 1.7 cm in diameter with left to right shunt on Colour Doppler. Peak systolic gradient across ASD is 4.4 mm of Hg.",
    );
    expect(text).toContain("Dilated right atrium and right ventricle.");
    expect(r.impression).toContain("Atrial septal defect with left to right shunt.");
    expect(r.impression).toContain("Dilated right atrium and right ventricle.");
  });

  test("RHD MS+AS chip: 'AoV … Normal thickness & excursions' removed, verbatim valve lines inserted", () => {
    let state = withPathology("echo", "echo-valves", "echo-rhd-ms-as");
    state = setOrganVar(state, "echo-valves", "mva", "2.5");
    const r = resolve(state, lookupAll, "t");
    const text = r.sections.find((s) => s.organ === "echo-valves")!.text;
    expect(text).not.toContain("Aortic Valve ( AoV ) : Normal thickness & excursions.");
    expect(text).toContain("Aortic Valve ( AoV ) : Mildly thickened with early sclerotic changes & reduced excursions.");
    expect(text).toContain("The AML show moderate to severely thickened cusps, no calcification, no doming. MV area 2.5 cm².");
    expect(r.impression).toContain("Rheumatic heart disease.");
    expect(r.impression.some((l) => /Mild aortic stenosis\. Moderate to severe mitral stenosis/i.test(l))).toBe(true);
  });

  test("existing pericardial-effusion chip removes the baseline 'Pericardium : No effusion.' line", () => {
    const text = organText("echo", "echo-valves", "echo-pericardial-effusion");
    expect(text).not.toContain("Pericardium : No effusion.");
    expect(text).toContain("Pericardium : Mild pericardial effusion.");
    expect(text).toContain("IVS ( Interventricular Septum ) : Intact."); // rest of scaffold kept
  });
});

describe("PAH chip on echo-others", () => {
  test("echo-pah replaces the normal pulmonary-trunk line and imprints the impression", () => {
    const r = resolve(withPathology("echo", "echo-others", "echo-pah"), lookupAll, "t");
    const text = r.sections.find((s) => s.organ === "echo-others")!.text;
    expect(text).not.toContain("Normal pulmonary trunk & its branches.");
    expect(text).toContain("Pulmonary arterial hypertension.");
    expect(text).toContain("Situs solitus, normal atrioventricular & ventriculo-arterial drainage with left sided aortic arch.");
    expect(r.impression).toContain("Pulmonary arterial hypertension.");
  });
});

describe("Chip catalog integrity for the new adult echo defs", () => {
  test("keys resolve through the unified lookup with organ and vars wired", () => {
    for (const key of ["echo-vsd-valves", "echo-asd-valves", "echo-rhd-ms-as", "echo-pah"]) {
      const p = getPathologyAny(key);
      expect(p?.builtin).toBe(true);
      expect(p?.text).toBeTruthy();
      expect(p?.impression.length).toBeGreaterThan(0);
    }
    expect(getPathologyAny("echo-vsd-valves")?.organ).toBe("echo-valves");
    expect(getPathologyAny("echo-pah")?.organ).toBe("echo-others");
  });
});

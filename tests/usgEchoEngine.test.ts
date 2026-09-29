/**
 * Echo content engine (cursor/usg-echo-content-engine) — verbatim baselines,
 * conflictGroup slot chips, cross-organ contradiction reconciliation,
 * variable substitution, PHI scan and resolver/format-search regressions.
 *
 * Every expected string below is transcribed verbatim from the 15 signed
 * clinic reports (whitespace normalised only) — see the PR provenance table.
 */
import { describe, expect, test } from "vitest";
import { initialState, getStudy } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { USG_PATHOLOGIES_EXTRA, ECHO_RECOMMENDATIONS } from "@/lib/usg/pathologies-extra";
import { PATHOLOGY_ADVICE } from "@/lib/usg/pathologyAdvice";
import {
  applyMacroBundle,
  applyPathology,
  makeLookup,
  pathologiesForOrgan,
  resolve,
  setOrganVar,
} from "@/lib/usg/composer";
import { BUILTIN_NP_TEMPLATES } from "@/lib/usg/npTemplates";
import { filterFormatsByQuery, formatMetaForStudyKey, type SearchableFormat } from "@/lib/usg/formatSearch";
import { resolveBilledStudyType } from "@/lib/usg/billedStudyType";

const lookupAll = makeLookup(USG_PATHOLOGIES_ALL);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function seededFormats(): SearchableFormat[] {
  return BUILTIN_NP_TEMPLATES.map((t, i) => {
    const meta = formatMetaForStudyKey(t.studyKey);
    return {
      id: `seed-${i}`,
      name: t.name,
      studyKey: t.studyKey,
      studyType: meta.studyType,
      category: meta.category,
      searchAliases: [...t.searchAliases],
      organKeywords: meta.organKeywords,
    };
  });
}

function organText(state: ReturnType<typeof initialState>, key: string): string {
  return state.organs.find((o) => o.organ === key)?.text ?? "";
}

describe("Verbatim baselines — one per echo family", () => {
  test("adult M-mode table is the doctor's own JUN_086 wording", () => {
    const t = organText(initialState("echo"), "echo-mmode");
    expect(norm(t)).toContain("LA ( Left Atrial Diameter ) : {LA_mm} mm ( Normal 20 - 40 mm )");
    expect(norm(t)).toContain("RV Anterior wall thickness : Normal");
    expect(norm(t)).toContain("PW (s) ( Posterior Wall in Systole ) : {PWs_mm} mm ( Normal 6 - 14 mm )");
  });

  test("streamlined format equals the NEW FORMAT report verbatim (tokens aside)", () => {
    expect(norm(organText(initialState("echo-streamlined"), "echo-chambers"))).toBe(
      norm(`Left Ventricle :-
        Cavity size – Normal.
        Wall thickness – Normal.
        Wall motion abnormality – None.
        Left Ventricle Ejection Fraction – {LVEF_pct}%.

        Left Atrium :- Normal in size.

        Right Ventricle :- Normal in size.

        Right Atrium :- Normal in size.`),
    );
    expect(organText(initialState("echo-streamlined"), "echo-valves")).toContain(
      "IAS & IVS :-\nIAS- Intact.\nIVS- Intact.",
    );
  });

  test("pediatric colour-Doppler format equals the signed peds reports verbatim", () => {
    const s = initialState("echo-peds");
    expect(norm(organText(s, "echo-others"))).toContain(
      norm("Levo Cardiac Position of Heart. Viscero-Arterial Situs Solitus. D-Looped Ventricles."),
    );
    expect(organText(s, "echo-func")).toContain("Good LV & RV Systolic Functions. LVEF= {LVEF_pct} % on B-mode.");
  });

  test("fetal echo format equals the signed fetal reports verbatim", () => {
    const s = initialState("fetal-echo");
    expect(organText(s, "fetal-echo-chambers")).toBe(
      "Chamber dimensions are within normal limits.\nForamen Ovale is visualized with flap opening into the left atrium.\nThe IVS appears to be intact.",
    );
    expect(organText(s, "fetal-echo-ductus")).toBe("Ductus arteriosus is patent with normal waveform.");
  });
});

describe("Slot chips — same-slot replacement, deterministic undo", () => {
  test("VSD chip swaps ONLY the IVS line; IAS, valves and scaffold survive", () => {
    const s = applyMacroBundle(initialState("echo-streamlined"), "echo-valves", ["echx-vsd-perimembranous"], lookupAll);
    const t = organText(s, "echo-valves");
    expect(t).toContain("Subaortic perimembranous VSD measuring {defect_mm} mm in diameter with left to right shunt on Color Doppler.");
    expect(t).toContain("Peak Systolic gradient across VSD is {gradient_mmHg} mm of Hg.");
    expect(t).not.toContain("IVS- Intact.");
    expect(t).toContain("IAS- Intact.");
    expect(t).toContain("Mitral Valve :- Morphology – Normal.");
  });

  test("undo re-derives the verbatim baseline from the study normal", () => {
    const a = applyMacroBundle(initialState("echo-streamlined"), "echo-valves", ["echx-vsd-perimembranous"], lookupAll);
    const b = applyMacroBundle(a, "echo-valves", ["echx-vsd-perimembranous"], lookupAll);
    expect(organText(b, "echo-valves")).toBe(organText(initialState("echo-streamlined"), "echo-valves"));
  });

  test("later click wins inside one conflictGroup (PR replaces PS on the PV slot)", () => {
    let s = applyMacroBundle(initialState("echo-streamlined"), "echo-valves", ["echx-pulmonary-stenosis"], lookupAll);
    s = applyMacroBundle(s, "echo-valves", ["echx-pulmonary-regurgitation"], lookupAll);
    const t = organText(s, "echo-valves");
    expect(t).toContain("{sev} pulmonary regurgitation.");
    expect(t).not.toContain("Pulmonary Stenosis.");
  });

  test("[OWNER-REVIEW] stubs are inert — clicking cannot change the text", () => {
    const s = applyMacroBundle(initialState("echo-streamlined"), "echo-valves", ["echx-mitral-regurgitation"], lookupAll);
    expect(organText(s, "echo-valves")).toBe(organText(initialState("echo-streamlined"), "echo-valves"));
  });
});

describe("Contradiction reconciliation", () => {
  test("ASD chip removes 'IAS: Intact' equivalent and VSD removes 'IVS: Intact'", () => {
    const s = applyPathology(initialState("echo"), "echo-valves", "echx-asd-ostium-secundum", lookupAll);
    const t = organText(s, "echo-valves");
    expect(t).toContain("Ostium secondum ASD measuring {defect_mm} mm");
    expect(t).not.toContain("IAS ( Interatrial Septum ) : Intact.");
    expect(t).toContain("IVS ( Interventricular Septum ) : Intact.");
  });

  test("'No PDA / ASD / VSD.' degrades token-by-token and finally disappears", () => {
    let s = applyMacroBundle(initialState("echo"), "echo-valves", ["echx-vsd-perimembranous"], lookupAll);
    expect(organText(s, "echo-others")).toContain("No PDA / ASD.");
    s = applyMacroBundle(s, "echo-valves", ["echx-asd-ostium-secundum"], lookupAll);
    expect(organText(s, "echo-others")).toContain("No PDA.");
    s = applyMacroBundle(s, "echo-others", ["echx-pda"], lookupAll);
    expect(organText(s, "echo-others")).toContain("Patent ductus arteriosus.");
    expect(organText(s, "echo-others")).not.toContain("No PDA");
    // Undoing the VSD chip restores its word in the cross-organ sentence.
    s = applyMacroBundle(s, "echo-valves", ["echx-vsd-perimembranous"], lookupAll);
    expect(organText(s, "echo-others")).toContain("No VSD.");
    expect(organText(s, "echo-others")).not.toContain("No PDA");
  });

  test("PAH chip replaces 'Normal pulmonary trunk' / 'No evidence of Pulmonary Hypertension'", () => {
    const a = applyPathology(initialState("echo"), "echo-others", "echx-pah", lookupAll);
    expect(organText(a, "echo-others")).toContain("Pulmonary arterial hypertension.");
    expect(organText(a, "echo-others")).not.toContain("Normal pulmonary trunk");
    const b = applyPathology(initialState("echo-peds"), "echo-func", "echx-pah", lookupAll);
    expect(organText(b, "echo-func")).toContain("Pulmonary arterial hypertension.");
    expect(organText(b, "echo-func")).not.toContain("No evidence of Pulmonary Hypertension.");
  });

  test("dilatation chip removes 'No chamber dilatation.' from its own card", () => {
    const s = applyPathology(initialState("echo-peds"), "echo-valves", "echx-ra-rv-dilatation", lookupAll);
    const t = organText(s, "echo-valves");
    expect(t).toContain("Dilated RA (~{RA_cav_mm} mm) and RV (~{RV_cav_mm} mm) cavities.");
    expect(t).not.toContain("No chamber dilatation.");
  });

  test("dextrocardia flips the situs preamble but never swallows the septa sentence", () => {
    const s = applyPathology(initialState("echo"), "echo-others", "echx-dextrocardia", lookupAll);
    const t = organText(s, "echo-others");
    expect(t).toContain("Dextrocardia with cardiac apex towards right.");
    expect(t).not.toContain("Situs solitus, normal atrioventricular");
    expect(t).toContain("No PDA / ASD / VSD.");
  });

  test("regurgitation chips replace the valve 'Doppler flow – Normal.' block only", () => {
    const s = applyPathology(initialState("echo-streamlined"), "echo-valves", "echx-tricuspid-regurgitation", lookupAll);
    const t = organText(s, "echo-valves");
    expect(t).toContain("{sev} tricuspid regurgitation.");
    expect(t).not.toContain("Tricuspid Valve :- Morphology – Normal.");
    expect(t).toContain("Mitral Valve :- Morphology – Normal.");
    expect((t.match(/Doppler flow – Normal\./g) ?? []).length).toBe(3);
  });

  test("LV hypertrophy replaces 'Wall thickness – Normal.' and keeps the rest of the LV block", () => {
    const s = applyPathology(initialState("echo-streamlined"), "echo-chambers", "echx-lv-hypertrophy", lookupAll);
    const t = organText(s, "echo-chambers");
    expect(t).toContain("Hypertrophied LV wall.");
    expect(t).not.toContain("Wall thickness – Normal.");
    expect(t).toContain("Cavity size – Normal.");
  });
});

describe("Variable substitution", () => {
  test("LVEF typed on the diastolic-dysfunction chip renders verbatim line", () => {
    let s = applyPathology(initialState("echo-streamlined"), "echo-chambers", "echx-early-lv-diastolic-dysfunction", lookupAll);
    s = setOrganVar(s, "echo-chambers", "LVEF_pct", "54");
    const r = resolve(s, lookupAll, "t");
    expect(r.sections.find((x) => x.organ === "echo-chambers")!.text).toContain("Early LV diastolic dysfunction– LVEF – 54%");
    expect(r.impression.join(" ")).toContain("Early LV diastolic dysfunction.");
  });

  test("VSD defect 5.2 / gradient 55.0 render into the finding", () => {
    let s = applyMacroBundle(initialState("echo"), "echo-valves", ["echx-vsd-perimembranous"], lookupAll);
    s = setOrganVar(s, "echo-valves", "defect_mm", "5.2");
    s = setOrganVar(s, "echo-valves", "gradient_mmHg", "55.0");
    const r = resolve(s, lookupAll, "t");
    const t = r.sections.find((x) => x.organ === "echo-valves")!.text;
    expect(t).toContain("measuring 5.2 mm in diameter");
    expect(t).toContain("gradient across VSD is 55.0 mm of Hg");
  });

  test("MS severity is radiologist-typed and renders distinct mild vs moderate-to-severe lines", () => {
    let s = applyPathology(initialState("echo-streamlined"), "echo-valves", "echx-ms-rheumatic", lookupAll);
    s = setOrganVar(s, "echo-valves", "sev", "Mild");
    s = setOrganVar(s, "echo-valves", "MVA_cm2", "2.5");
    const mild = resolve(s, lookupAll, "t");
    expect(mild.impression.join(" ")).toContain("Mild mitral stenosis.");
    expect(mild.sections.find((x) => x.organ === "echo-valves")!.text).toContain("MVA - 2.5 cm²");

    let s2 = applyPathology(initialState("echo-streamlined"), "echo-valves", "echx-ms-rheumatic", lookupAll);
    s2 = setOrganVar(s2, "echo-valves", "sev", "Moderate to severe");
    const severe = resolve(s2, lookupAll, "t");
    expect(severe.impression.join(" ")).toContain("Moderate to severe mitral stenosis.");
    expect(severe.impression.join(" ")).toContain("Rheumatic heart disease.");
    expect(severe.impression).not.toEqual(mild.impression);
  });
});

describe("Recommendations are options, never auto-applied", () => {
  test("no echx chip carries advice/suggestions and none exists in PATHOLOGY_ADVICE", () => {
    for (const p of USG_PATHOLOGIES_EXTRA.filter((x) => x.key.startsWith("echx-"))) {
      expect(p.advice ?? []).toEqual([]);
      expect(p.suggestions ?? []).toEqual([]);
      expect(PATHOLOGY_ADVICE[p.key]).toBeUndefined();
    }
  });

  test("resolving every real echx chip never emits a recommendation line", () => {
    for (const p of USG_PATHOLOGIES_EXTRA) {
      if (!p.key.startsWith("echx-") || !p.findingsText?.trim()) continue;
      const study = p.organ === "fetal-echo-conclusion" ? "fetal-echo" : p.organ === "echo-chambers" ? "echo-streamlined" : "echo";
      const organKey = p.organ === "echo-pulmonary" ? "echo-others" : p.organ;
      const r = resolve(applyPathology(initialState(study), organKey, p.key, lookupAll), lookupAll, "t");
      const all = norm(r.sections.map((x) => x.text).join(" ") + " " + r.impression.join(" "));
      for (const rec of ECHO_RECOMMENDATIONS) expect(all).not.toContain(norm(rec));
    }
  });

  test("fetal echo study no longer carries the post-natal advice as a default", () => {
    const r = resolve(initialState("fetal-echo"), lookupAll, "t");
    expect(r.impression.join(" ") + norm(r.sections.map((x) => x.text).join(" "))).not.toContain("Post-natal");
  });
});

describe("Fetal chordae chip", () => {
  test("rewrites the conclusion sentence and adds the calcification impression", () => {
    let s = applyPathology(initialState("fetal-echo"), "fetal-echo-conclusion", "echx-fetal-echogenic-focus-chordae", lookupAll);
    s = setOrganVar(s, "fetal-echo-conclusion", "weeks", "21");
    s = setOrganVar(s, "fetal-echo-conclusion", "days", "6");
    s = setOrganVar(s, "fetal-echo-conclusion", "presentation", "cephalic");
    const r = resolve(s, lookupAll, "t");
    const t = r.sections.find((x) => x.organ === "fetal-echo-conclusion")!.text;
    expect(t).toContain("A single live intrauterine fetus at 21 weeks 6 days of average gestational age in cephalic presentation with a tiny foci of intracardiac calcification in left ventricle in relation to chordae tendineae.");
    expect(t).not.toContain("no significant cardiac abnormality");
    expect(r.impression.join(" ")).toContain("A tiny foci of intracardiac calcification in left ventricle in relation to chordae tendineae.");
  });
});

describe("Chip placement", () => {
  test("engine chips surface on the cards their conflictGroup vocabulary names", () => {
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "echo-valves").some((c) => c.key === "echx-vsd-perimembranous")).toBe(true);
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "echo-others").some((c) => c.key === "echx-pah")).toBe(true);
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "echo-func").some((c) => c.key === "echx-pah")).toBe(true);
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "echo-chambers").some((c) => c.key === "echx-lv-hypertrophy")).toBe(true);
    expect(pathologiesForOrgan(USG_PATHOLOGIES_ALL, "fetal-echo-conclusion").some((c) => c.key === "echx-fetal-echogenic-focus-chordae")).toBe(true);
  });
});

describe("Format search + picker", () => {
  const formats = seededFormats();
  const keysFor = (q: string) => filterFormatsByQuery(formats, q).map((f) => f.studyKey);

  test("'2d echo' / 'm-mode' hit the adult format; 'echo' hits every echo family", () => {
    expect(keysFor("2d echo")).toContain("echo");
    expect(keysFor("m-mode")).toContain("echo");
    for (const k of ["echo", "echo-streamlined", "echo-peds", "fetal-echo"]) expect(keysFor("echo")).toContain(k);
  });

  test("'pediatric echo' hits only the pediatric format; 'streamlined' only the streamlined one", () => {
    expect(keysFor("pediatric echo")).toEqual(["echo-peds"]);
    expect(keysFor("streamlined echo")).toEqual(["echo-streamlined"]);
  });

  test("'fetal echo' hits the fetal format and never the adult one", () => {
    expect(keysFor("fetal echo")).toContain("fetal-echo");
    expect(keysFor("fetal echo")).not.toContain("echo");
  });

  test("'cardiac' keeps matching the adult echo, not the streamlined/peds ones", () => {
    const echoFamily = keysFor("cardiac").filter((k) => k === "echo" || k.startsWith("echo-"));
    expect(echoFamily).toEqual(["echo"]);
  });
});

describe("Billing resolver regressions", () => {
  test("ECHO→echo · ECHO FETAL / USGFE→fetal-echo · FETAL DOPPLER→ob", () => {
    expect(resolveBilledStudyType("ECHO")).toBe("echo");
    expect(resolveBilledStudyType("2D ECHO")).toBe("echo");
    expect(resolveBilledStudyType("ECHO FETAL")).toBe("fetal-echo");
    expect(resolveBilledStudyType("USGFE")).toBe("fetal-echo");
    expect(resolveBilledStudyType("FETAL DOPPLER")).toBe("ob");
  });

  test("the echo study family all resolve to real studies", () => {
    for (const k of ["echo", "echo-streamlined", "echo-peds", "fetal-echo"]) expect(getStudy(k)).toBeTruthy();
  });
});

describe("PHI scan — seeded echo content is free of patient/machine metadata", () => {
  const FORBIDDEN = [
    /transcripted/i,
    /\btypist\b/i,
    /thanks for your referral/i,
    /as advised by/i,
    /refd/i,
    /\bage\s*:-/i,
    /\bdate\s*:/i,
    /\bTIME \@/i,
    /\bDATE \@",?/i,
    /\d{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    /\d{2}\.\d{2}\.\d{4}/,
    /reliability of sonographic/i,
    /REBLIABILITY/i,
    /GUNJAN|PANDEY|FARIDA|KHATOON|RAJESH|Gautam|Jaldhar|PARO|PIYUSH|ABU|SHAMA|SATRUGHAN|RUBY|BODEHI|SWETA|SAHAY|ASHA|SHARDHA|TINU|JAIN|ANSARI|ANIL KUMAR|RAMAN KUMAR|NEHA PRIYA|SADHANA|SANJAY KUMAR/i,
  ];

  test("echo study normals carry no PHI", () => {
    for (const k of ["echo", "echo-streamlined", "echo-peds", "fetal-echo"]) {
      for (const o of getStudy(k)!.organs) {
        for (const re of FORBIDDEN) expect(norm(o.normal).match(re)).toBeNull();
      }
    }
  });

  test("echx-* chips carry no PHI", () => {
    for (const p of USG_PATHOLOGIES_EXTRA.filter((x) => x.key.startsWith("echx-"))) {
      for (const re of FORBIDDEN) expect(norm(`${p.text} ${p.impression.join(" ")}`).match(re)).toBeNull();
    }
  });

  test("ECHO_RECOMMENDATIONS carry no doctor names, typists or dates", () => {
    for (const rec of ECHO_RECOMMENDATIONS) {
      for (const re of FORBIDDEN) expect(norm(rec).match(re)).toBeNull();
    }
  });
});

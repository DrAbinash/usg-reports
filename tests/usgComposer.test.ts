/**
 * USG composer tests — the doctor's core rule: selecting a pathology swaps
 * ONLY that organ's finding, keeps every other organ normal, recomposes the
 * impression, and the whole thing prints on the letterhead.
 */
import { describe, expect, test } from "vitest";
import { initialState, getStudy, USG_STUDIES } from "@/lib/usg/studies";
import { USG_PATHOLOGIES } from "@/lib/usg/pathologies";
import {
  applyPathology,
  extractTokens,
  makeLookup,
  normaliseState,
  resolve,
  setOrganText,
  setOrganVar,
  substitute,
  switchStudy,
} from "@/lib/usg/composer";
import { buildUsgReportHtml } from "@/lib/usg/print";

const lookup = makeLookup(USG_PATHOLOGIES);

describe("USG studies", () => {
  test("five study types exist with unique organ lists", () => {
    expect(USG_STUDIES.map((s) => s.key)).toEqual(["wa-female", "wa-male", "ua", "la-female", "la-male"]);
    for (const s of USG_STUDIES) {
      expect(s.organs.length).toBeGreaterThan(4);
      expect(s.allNormalImpression.length).toBeGreaterThan(0);
      const keys = s.organs.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test("female whole abdomen has uterus/adnexa/pod; male has prostate/rif", () => {
    const f = getStudy("wa-female")!;
    const m = getStudy("wa-male")!;
    expect(f.organs.map((o) => o.key)).toContain("uterus");
    expect(f.organs.map((o) => o.key)).not.toContain("prostate");
    expect(m.organs.map((o) => o.key)).toContain("prostate");
    expect(m.organs.map((o) => o.key)).not.toContain("uterus");
  });

  test("whole-abdomen normals carry no fill-in blanks (one tap prints)", () => {
    for (const key of ["wa-female", "wa-male", "ua"]) {
      const study = getStudy(key)!;
      for (const o of study.organs) {
        expect(extractTokens(o.normal), `${key}/${o.key}`).toEqual([]);
      }
    }
  });
});

describe("USG catalog sanity", () => {
  test("every pathology's organ exists in at least one study (kidney common allowed)", () => {
    const organKeys = new Set<string>();
    for (const s of USG_STUDIES) s.organs.forEach((o) => organKeys.add(o.key));
    organKeys.add("kidney"); // side-agnostic entries used by both kidney slots
    for (const p of USG_PATHOLOGIES) {
      expect(organKeys.has(p.organ), `${p.key} → ${p.organ}`).toBe(true);
    }
  });

  test("every pathology has finding text, an impression line, and unique key", () => {
    const keys = new Set<string>();
    for (const p of USG_PATHOLOGIES) {
      expect(p.text.trim().length).toBeGreaterThan(10);
      expect(p.impression.length).toBeGreaterThan(0);
      expect(keys.has(p.key), `duplicate key ${p.key}`).toBe(false);
      keys.add(p.key);
    }
  });

  test("declared vars match the {tokens} actually used in the text", () => {
    for (const p of USG_PATHOLOGIES) {
      const tokens = extractTokens(p.text);
      const declared = (p.vars ?? []).map((v) => v.key);
      for (const t of tokens) {
        // {side}/{Side} are auto-filled for kidney slots; everything else must be declared
        if (t === "side" || t === "Side") continue;
        expect(declared, `${p.key} missing var ${t}`).toContain(t);
      }
    }
  });
});

describe("USG composer — the fatty liver rule", () => {
  test("all-normal female whole abdomen prints the doctor's normal impression", () => {
    const r = resolve(initialState("wa-female"), lookup, "T");
    expect(r.impression).toEqual([
      "Normal scan of upper abdomen.",
      "Normal sized uterus with normal endometrial thickness.",
    ]);
    expect(r.title).toBe("USG WHOLE ABDOMEN");
    expect(r.sections.length).toBe(13);
  });

  test("selecting Fatty Liver Gr I swaps ONLY the liver finding", () => {
    let state = initialState("wa-female");
    const before = resolve(state, lookup, "T").sections;
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const r = resolve(state, lookup, "T");

    const liver = r.sections.find((s) => s.organ === "liver")!;
    expect(liver.text).toContain("Grade I Fatty Changes");
    expect(liver.text).toContain("___ cm"); // measurement blank until filled

    // every other organ keeps its normal line
    for (const s of r.sections) {
      if (s.organ === "liver") continue;
      const orig = before.find((b) => b.organ === s.organ)!;
      expect(s.text).toBe(orig.text);
    }

    // impression recomposes: pathology line + trailing normal summaries
    expect(r.impression).toEqual([
      "Fatty infiltration of liver (Grade I).",
      "Normal sized uterus with normal endometrial thickness.",
      "Bilateral adenexa normal in morphology.",
      "No POD collection.",
    ]);

    // study title gains the fragment
    expect(r.title).toBe("USG WHOLE ABDOMEN WITH GRADE I FATTY CHANGES");
  });

  test("filled measurements substitute into finding and impression", () => {
    let state = initialState("wa-male");
    state = applyPathology(state, "liver", "liver-hepatomegaly-fatty-g1", lookup);
    state = setOrganVar(state, "liver", "span", "15.2");
    state = setOrganVar(state, "liver", "pv", "1.1");
    const r = resolve(state, lookup, "T");
    const liver = r.sections.find((s) => s.organ === "liver")!;
    expect(liver.text).toContain("mid-clavicular line 15.2 cm");
    expect(liver.text).toContain("It measures 1.1 cm.");
    expect(r.impression[0]).toBe("Hepatomegaly with fatty infiltration of liver (Grade I).");
  });

  test("kidney side tokens auto-fill Right/Left on the correct slot", () => {
    let state = initialState("wa-male");
    state = applyPathology(state, "kidney_rt", "kidney-calculus", lookup);
    state = setOrganVar(state, "kidney_rt", "size", "1.2");
    state = setOrganVar(state, "kidney_rt", "loc", "lower pole");
    const r = resolve(state, lookup, "T");
    const rt = r.sections.find((s) => s.organ === "kidney_rt")!;
    expect(rt.text).toContain("Right kidney is normal in shape");
    expect(rt.text).toContain("right kidney");
    expect(r.impression[0]).toBe("Right nephrolithiasis (1.2 cm calculus at the lower pole).");
    expect(r.title).toContain("RIGHT RENAL CALCULUS");
  });

  test("two pathologies compose in organ order with suggestions deduped", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "gb", "gb-calculus-few", lookup);
    state = applyPathology(state, "adnexa", "adnexa-pcod", lookup);
    const r = resolve(state, lookup, "T");
    expect(r.impression[0]).toContain("Cholelithiasis");
    expect(r.impression[1]).toBe("Bilateral polycystic ovaries.");
    // uterus/pod still normal → trailing lines present, upper group NOT all normal
    expect(r.impression).toContain("Normal sized uterus with normal endometrial thickness.");
    expect(r.impression).not.toContain("Normal scan of upper abdomen.");
  });

  test("upper group fully normal + gyn pathology opens with 'Normal scan of upper abdomen.'", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "uterus", "uterus-bulky", lookup);
    const r = resolve(state, lookup, "T");
    expect(r.impression[0]).toBe("Normal scan of upper abdomen.");
    expect(r.impression).toContain("Bulky uterus with endometrial thickness ___ cm.");
  });

  test("manual impression override wins", () => {
    let state = initialState("wa-male");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    state = { ...state, impressionOverride: "Custom line one\nCustom line two" };
    const r = resolve(state, lookup, "T");
    expect(r.impression).toEqual(["Custom line one", "Custom line two"]);
  });

  test("hand-edited organ text is respected (customisation)", () => {
    let state = initialState("wa-female");
    state = setOrganText(state, "others", "Nothing significant seen per Dr Sugandha.");
    const r = resolve(state, lookup, "T");
    expect(r.sections.find((s) => s.organ === "others")!.text).toBe("Nothing significant seen per Dr Sugandha.");
  });

  test("suggestions collected from selected pathologies", () => {
    let state = initialState("wa-male");
    state = applyPathology(state, "liver", "liver-sol-mets", lookup);
    const r = resolve(state, lookup, "T");
    expect(r.suggestions).toEqual(["Suggested: CECT abdomen", "Suggested: FNAC"]);
  });
});

describe("USG state handling", () => {
  test("switching study carries matching organs over", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const switched = switchStudy(state, "ua");
    expect(switched.studyKey).toBe("ua");
    expect(switched.organs.find((o) => o.organ === "liver")!.pathology).toBe("liver-fatty-g1");
    expect(switched.organs.find((o) => o.organ === "uterus")).toBeUndefined();
  });

  test("normaliseState survives junk payloads", () => {
    expect(() => normaliseState(null)).not.toThrow();
    expect(() => normaliseState("nonsense")).not.toThrow();
    expect(() => normaliseState({ studyKey: "nope", organs: [{ organ: "ghost" }] })).not.toThrow();
    const s = normaliseState({ studyKey: "wa-male" });
    expect(s.organs.map((o) => o.organ)).toEqual(getStudy("wa-male")!.organs.map((o) => o.key));
  });

  test("unknown pathology keys are ignored, not crashed", () => {
    const state = applyPathology(initialState("wa-female"), "liver", "does-not-exist", lookup);
    expect(state.organs.find((o) => o.organ === "liver")!.pathology).toBeNull();
  });

  test("wrong-organ pathology is rejected", () => {
    const state = applyPathology(initialState("wa-female"), "uterus", "liver-fatty-g1", lookup);
    expect(state.organs.find((o) => o.organ === "uterus")!.pathology).toBeNull();
  });

  test("substitute never leaks a raw token into the printout", () => {
    expect(substitute("measures {span} cm", {})).toBe("measures ___ cm");
    expect(substitute("{side} and {Side}", {}, "kidney_lt")).toBe("left and Left");
  });
});

describe("USG print document", () => {
  const settings = {
    appTitle: "CARE Reporting Studio",
    hospitalName: "CARE Diagnostics",
    addressLine: "Main Road",
    phone: "1234",
    email: "",
    logoUrl: "",
    footerMessage: "",
    usgDoctorName: "Dr. Sugandha Priyadarshini",
    usgDoctorQual: "MBBS, MD",
    usgDoctorRegNo: "REG-1",
    usgMachineLine: "This Scan has been proudly done on GE Voluson Pro 4-D USG Machine",
    usgShowMachine: true,
    usgFooterLine: "Kindly co-relate with clinico-pathological findings.",
    usgDeclarationLine: "",
  };

  test("letterhead + organ sections + impression render into the A4 document", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    state = setOrganVar(state, "liver", "span", "14.8");
    const r = resolve(state, lookup, "Ultrasonography of the whole abdomen…");
    const html = buildUsgReportHtml(
      settings,
      { name: "Test Patient", age: "34", sex: "F", referredBy: "Dr. Raj", date: "30 Aug 2026" },
      r,
    );
    expect(html).toContain("ULTRASOUND REPORT");
    expect(html).toContain("CARE Diagnostics");
    expect(html).toContain("USG WHOLE ABDOMEN WITH GRADE I FATTY CHANGES");
    expect(html).toContain("GE Voluson Pro 4-D USG Machine");
    expect(html).toContain("LIVER");
    expect(html).toContain("mid-clavicular line 14.8 cm");
    expect(html).toContain("Fatty infiltration of liver (Grade I).");
    expect(html).toContain("Dr. Sugandha Priyadarshini");
    expect(html).toContain("Kindly co-relate with clinico-pathological findings.");
    expect(html).not.toContain("{span}"); // no raw tokens ever reach the print
    expect(html).toContain("@page { size: A4");
  });

  test("machine banner and declaration are optional", () => {
    const r = resolve(initialState("wa-male"), lookup, "T");
    const html = buildUsgReportHtml(
      { ...settings, usgShowMachine: false, usgDeclarationLine: "PC-PNDT declaration text" },
      { name: "P", age: "40", sex: "M", referredBy: "", date: "30 Aug 2026" },
      r,
    );
    expect(html).not.toContain("GE Voluson");
    expect(html).toContain("PC-PNDT declaration text");
    expect(html).toContain("No significant abnormality detected.");
  });
});

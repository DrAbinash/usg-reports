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
  test("eight study types exist with unique organ lists", () => {
    expect(USG_STUDIES.map((s) => s.key)).toEqual([
      "wa-female", "wa-male", "ua", "la-female", "la-male", "wa-child", "ob", "ep",
    ]);
    for (const s of USG_STUDIES) {
      expect(s.organs.length).toBeGreaterThan(2);
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

  test("child whole abdomen has no prostate/uterus/adnexa/pod and measured organs", () => {
    const c = getStudy("wa-child")!;
    const keys = c.organs.map((o) => o.key);
    for (const forbidden of ["prostate", "uterus", "adnexa", "pod", "rif", "gravid-uterus"]) {
      expect(keys, `child must not carry ${forbidden}`).not.toContain(forbidden);
    }
    // measured paediatric normals ("A Normal child.doc")
    expect(c.organs.find((o) => o.key === "liver")!.normal).toContain("{span}");
    expect(c.organs.find((o) => o.key === "spleen")!.normal).toContain("{span}");
    expect(c.organs.find((o) => o.key === "kidney_rt")!.normal).toContain("{span}");
    // no post-void residual line for children
    expect(c.organs.find((o) => o.key === "ub")!.normal).not.toContain("post void");
    expect(c.organs.find((o) => o.key === "others")!.normal).toContain("mesenteric");
  });

  test("pregnancy studies carry the PC-PNDT flag and leading normal impression", () => {
    const ob = getStudy("ob")!;
    const ep = getStudy("ep")!;
    expect(ob.pcpndt).toBe(true);
    expect(ep.pcpndt).toBe(true);
    expect(getStudy("wa-female")!.pcpndt).toBeUndefined();
    expect(ob.normalImpressionFirst).toBe(true);
    expect(ep.normalImpressionFirst).toBe(true);
    expect(ob.title).toBe("ANTENATAL SCAN");
    expect(ep.defaultSuggestions).toContain("Anomaly scan to be done at 20-22 weeks of gestational age.");
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

  test("every pathology has finding text and unique key (cosmetic variants allowed)", () => {
    const keys = new Set<string>();
    for (const p of USG_PATHOLOGIES) {
      expect(p.text.trim().length).toBeGreaterThan(10);
      expect(Array.isArray(p.impression)).toBe(true);
      // an entry with no impression lines is a wording variant: no fragment either
      if (p.impression.length === 0) expect(p.titleFragment).toBeUndefined();
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
    // capitalised twin ({Position} picks up the filled {position} value)
    expect(substitute("{Position} low lying placenta", { position: "posteriorly" })).toBe("Posteriorly low lying placenta");
  });
});

describe("USG child study", () => {
  test("normal child report prints measured normals and the child impression", () => {
    let state = initialState("wa-child");
    state = setOrganVar(state, "liver", "span", "9.0");
    state = setOrganVar(state, "spleen", "span", "6.4");
    state = setOrganVar(state, "kidney_rt", "span", "6.6");
    state = setOrganVar(state, "kidney_lt", "span", "7.15");
    const r = resolve(state, lookup, "T");
    expect(r.title).toBe("USG WHOLE ABDOMEN");
    expect(r.impression).toEqual(["No significant abnormality detected."]);
    expect(r.sections.find((s) => s.organ === "liver")!.text).toContain("mid-clavicular line 9.0 cm");
    expect(r.sections.find((s) => s.organ === "spleen")!.text).toContain("Spleen measures 6.4 cm");
    expect(r.sections.find((s) => s.organ === "others")!.text).toContain("mesenteric");
    expect(r.sections.find((s) => s.organ === "others")!.text).toContain("intraperitoneal collection");
  });

  test("switching adult → child resets normals to measured wording, keeps pathologies", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const switched = switchStudy(state, "wa-child");
    // fatty liver selection survives the switch
    expect(switched.organs.find((o) => o.organ === "liver")!.pathology).toBe("liver-fatty-g1");
    // plain-normal organs adopt the child (measured) normals
    const spleen = switched.organs.find((o) => o.organ === "spleen")!;
    expect(spleen.text).toContain("{span}");
    expect(switched.organs.map((o) => o.organ)).not.toContain("uterus");
  });

  test("child pathologies swap the OTHERS section", () => {
    let state = initialState("wa-child");
    state = applyPathology(state, "others", "others-intestinal-obstruction", lookup);
    const r = resolve(state, lookup, "T");
    expect(r.sections.find((s) => s.organ === "others")!.text).toContain("to and fro");
    expect(r.impression[0]).toContain("S/O Intestinal Obstruction");
    expect(r.title).toBe("USG WHOLE ABDOMEN WITH INTESTINAL OBSTRUCTION");
  });
});

describe("USG pregnancy — antenatal (ob)", () => {
  test("normal antenatal report composes the GA line from biometry measurements", () => {
    let state = initialState("ob");
    // biometry card holds the mean GA values the impression quotes
    state = setOrganVar(state, "biometry", "gaw", "28");
    state = setOrganVar(state, "biometry", "gad", "05");
    state = setOrganVar(state, "biometry", "bpd", "69");
    state = setOrganVar(state, "biometry", "edd", "02.07.2014");
    const r = resolve(state, lookup, "T");
    expect(r.title).toBe("ANTENATAL SCAN");
    expect(r.impression).toEqual([
      "A single live intrauterine fetus at 28 wk 05 days of average gestational age in cephalic presentation.",
    ]);
    expect(r.sections.find((s) => s.organ === "biometry")!.text).toContain("B.P.D 69 mm");
    expect(r.sections.find((s) => s.organ === "biometry")!.text).toContain("E.D.D. as per scan : 02.07.2014");
    // unfilled slots render as blanks, never as raw tokens
    expect(r.sections.find((s) => s.organ === "biometry")!.text).toContain("___");
  });

  test("unfilled GA still prints blanks — no crash, no tokens", () => {
    const r = resolve(initialState("ob"), lookup, "T");
    expect(r.impression[0]).toBe(
      "A single live intrauterine fetus at ___ wk ___ days of average gestational age in cephalic presentation.",
    );
  });

  test("breech swaps ONLY the presentation line and the impression follows", () => {
    let state = initialState("ob");
    state = setOrganVar(state, "biometry", "gaw", "29");
    state = setOrganVar(state, "biometry", "gad", "00");
    state = applyPathology(state, "fetus", "fetus-breech", lookup);
    const r = resolve(state, lookup, "T");
    expect(r.sections.find((s) => s.organ === "fetus")!.text).toContain("breech presentation");
    // every other card keeps its normal text
    expect(r.sections.find((s) => s.organ === "placenta")!.text).toContain("not extending upto the lower segment");
    expect(r.sections.find((s) => s.organ === "liquor")!.text).toContain("Liquor AFI - ___ cm");
    expect(r.impression).toEqual([
      "A single live intrauterine fetus at 29 wk 00 days of average gestational age in breech presentation.",
    ]);
  });

  test("oligohydramnios keeps the leading GA line FIRST (obstetric order)", () => {
    let state = initialState("ob");
    state = setOrganVar(state, "biometry", "gaw", "27");
    state = setOrganVar(state, "biometry", "gad", "06");
    state = applyPathology(state, "liquor", "liquor-oligohydramnios", lookup);
    state = setOrganVar(state, "liquor", "afi", "5.2");
    const r = resolve(state, lookup, "T");
    expect(r.impression).toEqual([
      "A single live intrauterine fetus at 27 wk 06 days of average gestational age in cephalic presentation.",
      "Oligohydramnios ( AFI- 5.2 cm).",
    ]);
    expect(r.title).toBe("ANTENATAL SCAN WITH OLIGOHYDRAMNIOS");
  });

  test("placenta previa composes with the capitalised position twin", () => {
    let state = initialState("ob");
    state = applyPathology(state, "placenta", "placenta-previa-complete", lookup);
    state = setOrganVar(state, "placenta", "position", "posteriorly");
    state = setOrganVar(state, "placenta", "grade", "II");
    const r = resolve(state, lookup, "T");
    expect(r.sections.find((s) => s.organ === "placenta")!.text).toContain("completely covering internal Os");
    expect(r.impression).toContain("Posteriorly placenta previa, lower margin completely covering the internal Os.");
    expect(r.title).toBe("ANTENATAL SCAN WITH PLACENTA PREVIA");
  });

  test("cosmetic 'no gross anomalies' variant keeps the report normal", () => {
    let state = initialState("ob");
    state = applyPathology(state, "anatomy", "anatomy-no-gross-anomaly", lookup);
    const r = resolve(state, lookup, "T");
    expect(r.sections.find((s) => s.organ === "anatomy")!.text).toBe("No gross fetal congenital anomalies detected.");
    // still an all-normal report: GA line via allNormalImpression, no suggestions
    expect(r.impression[0]).toContain("A single live intrauterine fetus at");
    expect(r.title).toBe("ANTENATAL SCAN");
  });
});

describe("USG pregnancy — early (ep)", () => {
  test("normal early pregnancy composes embryo line + anomaly-scan reminder", () => {
    let state = initialState("ep");
    state = setOrganVar(state, "gravid-uterus", "gaw", "07");
    state = setOrganVar(state, "gravid-uterus", "gad", "03");
    state = setOrganVar(state, "gravid-uterus", "crl", "12.3");
    state = setOrganVar(state, "gravid-uterus", "fhr", "154");
    state = setOrganVar(state, "gravid-uterus", "edd", "07.05.2017");
    const r = resolve(state, lookup, "T");
    expect(r.title).toBe("USG LOWER ABDOMEN");
    expect(r.impression).toEqual([
      "A single live intrauterine embryo at 07 weeks 03 days of average gestational age.",
    ]);
    expect(r.suggestions).toEqual(["Anomaly scan to be done at 20-22 weeks of gestational age."]);
    const uterus = r.sections.find((s) => s.organ === "gravid-uterus")!;
    expect(uterus.text).toContain("Heart Rate: 154 bpm");
    expect(uterus.text).toContain("C.R.L. measures : 12.3 mm = 07 weeks 03 days");
  });

  test("missed abortion swaps the uterus finding and composes both lines", () => {
    let state = initialState("ep");
    state = applyPathology(state, "gravid-uterus", "gravid-missed-abortion", lookup);
    state = setOrganVar(state, "gravid-uterus", "gaw", "08");
    state = setOrganVar(state, "gravid-uterus", "gad", "06");
    state = setOrganVar(state, "gravid-uterus", "crl", "21.5");
    const r = resolve(state, lookup, "T");
    expect(r.sections.find((s) => s.organ === "gravid-uterus")!.text).toContain("No cardiac flickering");
    expect(r.impression).toEqual([
      "A single intrauterine embryo at 08 weeks 06 days of average gestational age. No cardiac activity or somatic movements seen.",
      "? Missed abortion.",
    ]);
    expect(r.suggestions).toEqual(["Suggested: Follow up scan"]);
  });

  test("ovarian cyst on the adnexa card composes after the embryo line", () => {
    let state = initialState("ep");
    state = setOrganVar(state, "gravid-uterus", "gaw", "06");
    state = setOrganVar(state, "gravid-uterus", "gad", "04");
    state = applyPathology(state, "adnexa", "adnexa-cyst-simple", lookup);
    state = setOrganVar(state, "adnexa", "side", "right");
    state = setOrganVar(state, "adnexa", "d1", "3.1");
    state = setOrganVar(state, "adnexa", "d2", "2.4");
    const r = resolve(state, lookup, "T");
    expect(r.impression[0]).toContain("A single live intrauterine embryo at 06 weeks 04 days");
    expect(r.impression[1]).toBe("Right adnexal simple cyst.");
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

  test("obstetric reports print the PC-PNDT statutory declaration block", () => {
    let state = initialState("ob");
    state = setOrganVar(state, "biometry", "gaw", "28");
    state = setOrganVar(state, "biometry", "gad", "05");
    const r = resolve(state, lookup, "T");
    const html = buildUsgReportHtml(
      settings,
      { name: "Pinki", age: "26", sex: "F", referredBy: "Dr. Reeta", date: "30 Aug 2026" },
      r,
    );
    expect(html).toContain("DECLARATION OF DOCTOR PERFORMING ULTRA SONOGRAPHY");
    expect(html).toContain("I Dr. Sugandha Priyadarshini, MBBS, MD declare that while conducting USG on above patient, I have neither detected nor disclosed the sex of the foetus to anybody in any manner.");
    expect(html).toContain("ANTENATAL SCAN");
    // non-obstetric reports never carry it
    const plain = buildUsgReportHtml(
      settings,
      { name: "P", age: "40", sex: "M", referredBy: "", date: "30 Aug 2026" },
      resolve(initialState("wa-male"), lookup, "T"),
    );
    expect(plain).not.toContain("DECLARATION OF DOCTOR PERFORMING ULTRA SONOGRAPHY");
  });
});

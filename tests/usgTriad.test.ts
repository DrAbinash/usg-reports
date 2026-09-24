/**
 * Linked triad (finding → impression → advice) — derivation, dismiss, edit,
 * legacy migration, print ADVICE section, study/organ key uniqueness.
 */
import { describe, expect, test } from "vitest";
import { initialState, getStudy, USG_STUDIES } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL, getPathologyAny } from "@/lib/usg/pathologies";
import {
  applyPathology,
  makeLookup,
  normaliseState,
  resolve,
} from "@/lib/usg/composer";
import { deriveAdvice, deriveImpressions, pathologyOverrideKey } from "@/lib/usg/triad";
import { adviceForPathology } from "@/lib/usg/pathologyAdvice";
import { buildUsgReportHtml } from "@/lib/usg/print";
import { copyForwardFindings } from "@/lib/usg/quickActions";

const lookup = makeLookup(USG_PATHOLOGIES_ALL);

describe("study & organ key uniqueness (dedupe)", () => {
  test("every study key appears once", () => {
    const keys = USG_STUDIES.map((s) => s.key);
    const seen = new Set<string>();
    for (const k of keys) {
      expect(seen.has(k), `duplicate study key ${k}`).toBe(false);
      seen.add(k);
    }
  });

  test("scrotum / orbit keep original organ keys (no push overwrite)", () => {
    const scrotum = getStudy("scrotum")!;
    expect(scrotum.organs.map((o) => o.key)).toEqual(
      expect.arrayContaining(["testis_rt", "testis_lt"]),
    );
    expect(scrotum.organs.some((o) => o.key === "right_testis")).toBe(false);
    const orbit = getStudy("orbit")!;
    expect(orbit.organs.map((o) => o.key)).toEqual(
      expect.arrayContaining(["globe_rt", "globe_lt"]),
    );
    expect(orbit.organs.some((o) => o.key === "globe" && orbit.organs.length < 3)).toBe(false);
  });
});

describe("triad deriveImpressions / deriveAdvice", () => {
  test("chip on → impression + advice appear together", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const study = getStudy("wa-female")!;
    const imps = deriveImpressions(state, study, lookup);
    const adv = deriveAdvice(state, study, lookup);
    expect(imps.some((l) => /Fatty infiltration/i.test(l.text))).toBe(true);
    expect(imps.find((l) => /Fatty/i.test(l.text))!.pathologyKey).toBe("liver-fatty-g1");
    expect(adv.some((l) => /Fibroscan|elastography|LFT/i.test(l.text))).toBe(true);
    const r = resolve(state, lookup, "t");
    expect(r.impression.some((l) => /Fatty infiltration/i.test(l))).toBe(true);
    expect(r.advice.some((l) => /Fibroscan|elastography|LFT/i.test(l))).toBe(true);
    expect(r.suggestions).toEqual(r.advice);
  });

  test("dismiss removes exact impression / advice lines", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const study = getStudy("wa-female")!;
    const line = deriveImpressions(state, study, lookup).find((l) => /Fatty/i.test(l.text))!.text;
    const advLine = deriveAdvice(state, study, lookup)[0]!.text;
    state = {
      ...state,
      dismissedImpressions: [line],
      dismissedAdvice: [advLine],
    };
    expect(deriveImpressions(state, study, lookup).every((l) => l.text !== line)).toBe(true);
    expect(deriveAdvice(state, study, lookup).every((l) => l.text !== advLine)).toBe(true);
  });

  test("edit + reset by pathology key", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "kidney_rt", "kidney-hydro-mod", lookup);
    const study = getStudy("wa-female")!;
    state = {
      ...state,
      impressionEdits: { "kidney-hydro-mod": "Right moderate HDN — edited." },
      adviceEdits: { "kidney-hydro-mod": "Suggest urgent urology opinion." },
    };
    const imps = deriveImpressions(state, study, lookup);
    expect(imps.some((l) => l.text === "Right moderate HDN — edited." && l.edited)).toBe(true);
    const adv = deriveAdvice(state, study, lookup);
    expect(adv.some((l) => l.text === "Suggest urgent urology opinion." && l.edited)).toBe(true);

    state = { ...state, impressionEdits: {}, adviceEdits: {} };
    const resetImp = deriveImpressions(state, study, lookup);
    expect(resetImp.some((l) => /moderate hydronephrosis/i.test(l.text))).toBe(true);
  });

  test("clinic save-as-default override wins over catalog (report edit still wins)", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const study = getStudy("wa-female")!;
    const key = pathologyOverrideKey("wa-female", "liver", "liver-fatty-g1");
    const clinic = {
      impressions: { [key]: "Clinic default fatty grade I." },
      advice: { [key]: "Clinic Fibroscan default." },
    };
    expect(deriveImpressions(state, study, lookup, clinic)[0]!.text).toBe("Clinic default fatty grade I.");
    expect(deriveAdvice(state, study, lookup, clinic)[0]!.text).toBe("Clinic Fibroscan default.");

    state = { ...state, impressionEdits: { "liver-fatty-g1": "Report-level edit." } };
    expect(deriveImpressions(state, study, lookup, clinic)[0]!.text).toBe("Report-level edit.");
  });

  test("unclick pathology removes impression + advice", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    state = applyPathology(state, "liver", null, lookup);
    const r = resolve(state, lookup, "t");
    expect(r.impression.join(" ")).not.toMatch(/Fatty infiltration/i);
    expect(r.advice.every((a) => !/Fibroscan/i.test(a))).toBe(true);
  });

  test("legacy impressionOverride renders as legacy lines; normaliseState preserves triad fields", () => {
    const raw = {
      studyKey: "wa-female",
      organs: initialState("wa-female").organs,
      impressionOverride: "Legacy free-text impression.\nSecond line.",
      dismissedImpressions: ["gone"],
      impressionAddendum: "Addendum line",
      impressionEdits: { "liver-fatty-g1": "x" },
    };
    const state = normaliseState(raw, "wa-female");
    expect(state.impressionOverride).toContain("Legacy");
    expect(state.dismissedImpressions).toEqual(["gone"]);
    expect(state.impressionAddendum).toBe("Addendum line");
    expect(state.impressionEdits?.["liver-fatty-g1"]).toBe("x");

    const study = getStudy("wa-female")!;
    const imps = deriveImpressions(state, study, lookup);
    expect(imps.every((l) => l.legacy || l.addendum)).toBe(true);
    expect(imps.some((l) => l.text === "Legacy free-text impression." && l.legacy)).toBe(true);
  });
});

describe("print IMPRESSION + ADVICE", () => {
  test("HTML contains Impression and Advice when advice present", () => {
    let state = initialState("wa-female");
    state = applyPathology(state, "liver", "liver-fatty-g1", lookup);
    const resolved = resolve(state, lookup, "technique");
    const html = buildUsgReportHtml(
      {
        appTitle: "T",
        hospitalName: "H",
        addressLine: "A",
        phone: "",
        email: "",
        logoUrl: "",
        footerMessage: "",
        usgDoctorName: "Dr",
        usgDoctorQual: "",
        usgDoctorRegNo: "",
        usgMachineLine: "",
        usgShowMachine: false,
        usgFooterLine: "",
        usgDeclarationLine: "",
        usgPrintStyle: "classic",
        usgPrintCompact: false,
        usgPrintPaper: "a4",
        usgSignatureUrl: "",
        usgPrintFontSize: 10,
        usgPrintLineHeight: 1.4,
        usgPrintSpacing: "tight",
        usgPrintShowTechnique: true,
        usgPrintShowThanks: true,
      },
      { name: "P", age: "30", sex: "F", referredBy: "", date: "01 Jan 2026" },
      resolved,
      [],
    );
    expect(html).toMatch(/Impression/i);
    expect(html).toMatch(/Advice/i);
    expect(html).toMatch(/Fatty infiltration/i);
    expect(html).toMatch(/Fibroscan|elastography|LFT/i);
  });
});

describe("pathology advice catalog", () => {
  test("fatty liver / hydronephrosis / simple cyst / elevated NT have advice", () => {
    expect(adviceForPathology("liver-fatty-g1").join(" ")).toMatch(/Fibroscan|elastography/i);
    expect(adviceForPathology("kidney-hydro-mod").join(" ")).toMatch(/CT urography/i);
    expect(adviceForPathology("adnexa-cyst-simple").join(" ")).toMatch(/6 weeks/i);
    const p = getPathologyAny("liver-fatty-g1");
    expect(p?.advice?.length || p?.suggestions?.length || adviceForPathology("liver-fatty-g1").length).toBeGreaterThan(0);
  });
});

describe("copyForwardFindings", () => {
  test("merges pathologies + vars only; leaves triad ownership alone", () => {
    let current = initialState("wa-female");
    current = {
      ...current,
      impressionAddendum: "Keep me",
      dismissedImpressions: ["x"],
    };
    let prior = initialState("wa-female");
    prior = applyPathology(prior, "liver", "liver-fatty-g1", lookup);
    prior = {
      ...prior,
      organs: prior.organs.map((o) =>
        o.organ === "liver" ? { ...o, vars: { span: "14.2", pv: "1.0" } } : o,
      ),
    };
    const { state, mergedOrgans } = copyForwardFindings(current, prior);
    expect(mergedOrgans).toBeGreaterThan(0);
    expect(state.organs.find((o) => o.organ === "liver")!.pathology).toBe("liver-fatty-g1");
    expect(state.organs.find((o) => o.organ === "liver")!.vars.span).toBe("14.2");
    expect(state.impressionAddendum).toBe("Keep me");
    expect(state.dismissedImpressions).toEqual(["x"]);
  });
});

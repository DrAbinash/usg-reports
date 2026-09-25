/**
 * Golden cases for AutoCompose impression engine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { composeImpression } from "@/lib/usg/autoCompose";

describe("composeImpression", () => {
  it("(a) clean normal — no chips on a known study → allNormalImpression", () => {
    const r = composeImpression({
      selectedChips: [],
      patient: { sex: "F", age: 30 },
      studyKey: "wa-female",
    });
    expect(r.criticalFirst).toEqual([]);
    expect(r.lines).toEqual([
      "Normal scan of upper abdomen.",
      "Normal sized uterus with normal endometrial thickness.",
    ]);
  });

  it("(b) fatty liver + gross hydro", () => {
    const r = composeImpression({
      selectedChips: [
        { organKey: "liver", chipKey: "liver-fatty-g1" },
        { organKey: "kidney_rt", chipKey: "kidney-hydro-gross" },
      ],
      patient: { sex: "F", age: 42 },
      studyKey: "wa-female",
    });
    expect(r.criticalFirst).toEqual([
      "**Gross hydronephrosis — obstructive uropathy likely.**",
    ]);
    expect(r.lines).toEqual([
      "**Gross hydronephrosis — obstructive uropathy likely.**",
      "Fatty infiltration of liver (Grade I).",
      "Right gross hydronephrosis with thinning out of cortex.",
      "Normal sized uterus with normal endometrial thickness.",
      "Bilateral adenexa normal in morphology.",
      "No POD collection.",
    ]);
  });

  it("(c) ectopic selected — critical line FIRST", () => {
    const r = composeImpression({
      selectedChips: [{ organKey: "adnexa", chipKey: "adnexa-ectopic" }],
      patient: { sex: "F", age: 28 },
      studyKey: "wa-female",
    });
    expect(r.criticalFirst).toEqual([
      "**Ectopic pregnancy detected — immediate clinical correlation required.**",
    ]);
    expect(r.lines).toEqual([
      "**Ectopic pregnancy detected — immediate clinical correlation required.**",
      "An ill defined tubo-ovarian mass in ___ adnexal region with surrounding anechoic collection and strong probe tenderness (UPT — Positive). F/S/O Ectopic Gestation.",
      "Normal scan of upper abdomen.",
      "Normal sized uterus with normal endometrial thickness.",
      "No POD collection.",
    ]);
  });

  describe("(d) OB study with LMP + biometry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15)); // 15-Jun-2026
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("emits exact LMP GA/EDD and Hadlock EFW percentile lines", () => {
      const r = composeImpression({
        selectedChips: [{ organKey: "fetus", chipKey: "fetus-breech" }],
        patient: { sex: "F", age: 26, lmp: "2026-01-01" },
        studyKey: "ob",
        biometry: { bpd: 70, hc: 258, ac: 234, fl: 52 },
      });
      expect(r.criticalFirst).toEqual([]);
      expect(r.lines).toEqual([
        "A single live intrauterine fetus at ___ wk ___ days of average gestational age in breech presentation.",
        "LMP GA: 23 weeks 4 days. EDD: 08-Oct-2026.",
        "EFW (Hadlock): 1127 g (± 170 g), 11th percentile.",
      ]);
    });
  });

  it("(e) no chips / unknown study → empty result", () => {
    const r = composeImpression({
      selectedChips: [],
      patient: {},
      studyKey: "",
    });
    expect(r).toEqual({ lines: [], criticalFirst: [] });
  });
});

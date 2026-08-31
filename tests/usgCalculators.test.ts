/**
 * Biometry + calculator tests (v5 phase 3) — reference values are published
 * Hadlock outputs for standard 28-week and term biometry, cross-checked
 * against the perinatology.com Hadlock calculator tables.
 *
 *   28 wk ≈ BPD 7.0 / HC 25.8 / AC 23.4 / FL 5.2 cm  → EFW ≈ 1.1–1.2 kg
 *   term ≈ BPD 9.5 / HC 33.0 / AC 33.0 / FL 7.0 cm  → EFW ≈ 3.0–3.2 kg
 */
import { describe, expect, it } from "vitest";
import { eddFromGa, efwTolerance, hadlockEfw, meanGa, perParameterGa, weeksDays } from "@/lib/usg/biometry";
import { afiCategory, afiTotal, ellipsoidVolume, postVoidResidual, prostateVolume, tiradsScore } from "@/lib/usg/calc";

describe("Hadlock EFW (Radiology 1985)", () => {
  it("4-parameter equation gives ≈ 1127 g at 28-week biometry", () => {
    const { best } = hadlockEfw({ bpd: 7.0, hc: 25.8, ac: 23.4, fl: 5.2 });
    expect(best?.key).toBe("H4");
    expect(best!.efw).toBeGreaterThan(1050);
    expect(best!.efw).toBeLessThan(1250);
  });

  it("4-parameter equation gives ≈ 3.0–3.2 kg at term biometry", () => {
    const { best } = hadlockEfw({ bpd: 9.5, hc: 33.0, ac: 33.0, fl: 7.0 });
    expect(best!.efw).toBeGreaterThan(2900);
    expect(best!.efw).toBeLessThan(3300);
  });

  it("falls back to fewer parameters when only some are entered", () => {
    const { formulas, best } = hadlockEfw({ ac: 23.4, fl: 5.2 });
    expect(formulas.map((f) => f.key)).toEqual(["H1"]);
    expect(best?.name).toContain("AC + FL");
  });

  it("returns nothing with no measurements", () => {
    expect(hadlockEfw({}).best).toBeNull();
  });

  it("3-parameter (HC+AC+FL) matches the published equation", () => {
    const { formulas } = hadlockEfw({ hc: 33.0, ac: 33.0, fl: 7.0 });
    const h3 = formulas.find((f) => f.key === "H3");
    // log10 EFW = 1.326 − 0.00326·231 + 0.0107·33 + 0.0438·33 + 0.158·7 → 10^3.478
    expect(h3!.efw).toBeGreaterThan(2950);
    expect(h3!.efw).toBeLessThan(3100);
  });
});

describe("Hadlock GA (1984 Table 1)", () => {
  it("BPD 9.5 cm ≈ 38–39 weeks", () => {
    const { bpd } = perParameterGa({ bpd: 9.5 });
    expect(bpd!.weeks).toBeGreaterThanOrEqual(38);
    expect(bpd!.weeks).toBeLessThanOrEqual(39);
  });

  it("FL 5.2 cm ≈ 27 weeks at 28-week biometry", () => {
    const { fl } = perParameterGa({ fl: 5.2 });
    expect(fl!.weeks).toBeGreaterThanOrEqual(26);
    expect(fl!.weeks).toBeLessThanOrEqual(28);
  });

  it("mean GA prefers the 4-parameter combination when all are present", () => {
    const ga = meanGa({ bpd: 7.0, hc: 25.8, ac: 23.4, fl: 5.2 });
    expect(ga?.formula).toContain("BPD+HC+AC+FL");
    expect(ga!.weeks).toBeGreaterThanOrEqual(27);
    expect(ga!.weeks).toBeLessThanOrEqual(29);
  });

  it("mean GA falls back to single-parameter AC when only AC is entered", () => {
    const ga = meanGa({ ac: 23.4 });
    expect(ga?.formula).toContain("AC");
  });

  it("returns null with no measurements", () => {
    expect(meanGa({})).toBeNull();
  });

  it("weeksDays splits 38.7 weeks into 38 weeks 5 days", () => {
    expect(weeksDays(38.7)).toEqual({ weeks: 38, days: 5 });
  });
});

describe("EDD from GA", () => {
  it("a 20-week scan on 1 Aug 2026 implies EDD 19 Dec 2026 (140 days left)", () => {
    const edd = eddFromGa(20, 0, new Date(2026, 7, 1));
    expect(edd.getFullYear()).toBe(2026);
    expect(edd.getMonth()).toBe(11);
    expect(edd.getDate()).toBe(19);
  });

  it("tolerance is 15% rounded to 10 g", () => {
    expect(efwTolerance(1127)).toBe(170);
    expect(efwTolerance(3073)).toBe(460);
  });
});

describe("clinical calculators", () => {
  it("ellipsoid volume: 4 × 3 × 2 cm ovary ≈ 12.6 cc", () => {
    expect(ellipsoidVolume(4, 3, 2)).toBeCloseTo(12.55, 1);
  });

  it("post-void residual uses the 0.52 bladder coefficient", () => {
    expect(postVoidResidual(8, 7, 6)).toBeCloseTo(174.72, 1);
  });

  it("prostate volume: 4.2 × 4.0 × 3.6 cm ≈ 31 cc (enlarged range)", () => {
    const v = prostateVolume(4.2, 4.0, 3.6);
    expect(v).toBeGreaterThan(30);
    expect(v).toBeLessThan(33);
  });

  it("AFI categories: 4 oligo, 12 normal, 26 poly", () => {
    expect(afiCategory(afiTotal(1, 1, 1, 1)).label).toBe("Oligohydramnios");
    expect(afiCategory(afiTotal(3, 3, 3, 3)).label).toBe("Normal");
    expect(afiCategory(afiTotal(7, 7, 6, 6)).label).toBe("Polyhydramnios");
  });
});

describe("ACR TI-RADS 2017", () => {
  it("spongiform / purely cystic nodules are TR1 regardless of other features", () => {
    const r = tiradsScore({
      composition: "spongiform",
      echogenicity: "hypoechoic",
      shape: "taller",
      margin: "extra_thyroidal",
      foci: ["punctate"],
    });
    expect(r.category).toBe("TR1");
    expect(r.guidance).toContain("No FNA");
  });

  it("solid isoechoic nodule (2+2) = 4 points → TR4, the classic ACR example", () => {
    const r = tiradsScore({
      composition: "solid",
      echogenicity: "isoechoic",
      shape: "wider",
      margin: "smooth_or_illdefined",
      foci: [],
    });
    expect(r.points).toBe(4);
    expect(r.category).toBe("TR4");
  });

  it("hyperechoic solid nodule (2+1) = 3 points → TR3", () => {
    const r = tiradsScore({
      composition: "solid",
      echogenicity: "hyperechoic_or_mixed",
      shape: "wider",
      margin: "smooth_or_illdefined",
      foci: [],
    });
    expect(r.points).toBe(3);
    expect(r.category).toBe("TR3");
  });

  it("hypoechoic solid (2+3=5) = TR4; adding taller-than-wide (5+3=8) = TR5", () => {
    const base = {
      composition: "solid" as const,
      echogenicity: "hypoechoic" as const,
      shape: "wider" as const,
      margin: "smooth_or_illdefined" as const,
      foci: [] as never[],
    };
    expect(tiradsScore(base).category).toBe("TR4");
    expect(tiradsScore({ ...base, shape: "taller" }).category).toBe("TR5");
  });

  it("taller-than-wide hypoechoic solid with punctate foci and ETE = 14 points → TR5", () => {
    const r = tiradsScore({
      composition: "solid",
      echogenicity: "hypoechoic",
      shape: "taller",
      margin: "extra_thyroidal",
      foci: ["punctate"],
    });
    expect(r.points).toBe(14);
    expect(r.category).toBe("TR5");
    expect(r.guidance).toContain("FNA");
  });

  it("size thresholds drive TR5 guidance: 12 mm → FNA, 8 mm → follow-up", () => {
    const tr5 = {
      composition: "solid" as const,
      echogenicity: "hypoechoic" as const,
      shape: "taller" as const,
      margin: "extra_thyroidal" as const,
      foci: ["punctate"] as never[],
    };
    expect(tiradsScore({ ...tr5, sizeMm: 12 }).guidance).toContain("FNA recommended");
    expect(tiradsScore({ ...tr5, sizeMm: 8 }).guidance).toContain("Follow-up");
  });

  it("TR3 (hyperechoic solid) at 30 mm → FNA; 18 mm → follow-up; 10 mm → nothing", () => {
    const tr3 = {
      composition: "solid" as const,
      echogenicity: "hyperechoic_or_mixed" as const,
      shape: "wider" as const,
      margin: "smooth_or_illdefined" as const,
      foci: [] as never[],
    };
    expect(tiradsScore({ ...tr3, sizeMm: 30 }).guidance).toContain("FNA recommended");
    expect(tiradsScore({ ...tr3, sizeMm: 18 }).guidance).toContain("Follow-up");
    expect(tiradsScore({ ...tr3, sizeMm: 10 }).guidance).toContain("No FNA");
  });

  it("foci points add: mixed hyperechoic (1+1) + macro + rim + punctate (6) = 8 → TR5", () => {
    const r = tiradsScore({
      composition: "mixed",
      echogenicity: "hyperechoic_or_mixed",
      shape: "wider",
      margin: "smooth_or_illdefined",
      foci: ["macrocalcification", "rim_calcification", "punctate"],
    });
    expect(r.points).toBe(8);
    expect(r.category).toBe("TR5");
  });
});

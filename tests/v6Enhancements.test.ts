/**
 * Tests for v6.6 features.
 */
import { describe, expect, it } from "vitest";
import { markAllNormal, isAllNormal, copyForwardMeasurements, copyForwardDiff } from "@/lib/usg/quickActions";
import { validateMeasurement, validateAllMeasurements, validationClass } from "@/lib/usg/measurementValidation";
import { matchSnippet, getAllSnippets } from "@/lib/usg/textExpansion";
import { buildGrowthChart } from "@/lib/usg/growthChart";
import { buildDailySummary } from "@/lib/usg/dailySummary";

// ── Quick Actions ─────────────────────────────────────────────────────────

describe("quickActions", () => {
  it("marks all organs normal (clears pathologies)", () => {
    const state = {
      studyKey: "wa-female",
      organs: [
        { organ: "liver", pathology: "liver-fatty-g1", pathologies: ["liver-fatty-g1"], custom: false, text: "Fatty", vars: {} },
        { organ: "gallbladder", pathology: null, pathologies: [], custom: false, text: "Normal", vars: {} },
      ],
      impressionOverride: null,
    };
    const normal = markAllNormal(state);
    expect(normal.organs.every((o) => o.pathology === null && (o.pathologies ?? []).length === 0)).toBe(true);
    expect(normal.impressionOverride).toBeNull();
  });

  it("detects when study is already all normal", () => {
    const state = {
      studyKey: "wa-female",
      organs: [{ organ: "liver", pathology: null, pathologies: [], custom: false, text: "Normal", vars: {} }],
      impressionOverride: null,
    };
    expect(isAllNormal(state)).toBe(true);
  });

  it("detects when study has pathologies", () => {
    const state = {
      studyKey: "wa-female",
      organs: [{ organ: "liver", pathology: "liver-fatty-g1", pathologies: ["liver-fatty-g1"], custom: false, text: "Fatty", vars: {} }],
      impressionOverride: null,
    };
    expect(isAllNormal(state)).toBe(false);
  });

  it("copies forward measurements from prior scan", () => {
    const current = {
      studyKey: "ob-growth",
      organs: [
        { organ: "ob_bpd", pathology: null, pathologies: [] as string[], custom: false, text: "BPD: {bpd} mm", vars: { bpd: "" } },
        { organ: "ob_fl", pathology: null, pathologies: [] as string[], custom: false, text: "FL: {fl} mm", vars: { fl: "" } },
      ],
      impressionOverride: null,
    };
    const prior = {
      studyKey: "ob-anomaly",
      organs: [
        { organ: "ob_bpd", pathology: null, pathologies: [] as string[], custom: false, text: "BPD: 50 mm", vars: { bpd: "50" } },
        { organ: "ob_fl", pathology: null, pathologies: [] as string[], custom: false, text: "FL: 38 mm", vars: { fl: "38" } },
      ],
      impressionOverride: null,
    };
    const { state, filledCount } = copyForwardMeasurements(current as any, prior as any);
    expect(filledCount).toBe(2);
    expect(state.organs[0]!.vars.bpd).toBe("50");
    expect(state.organs[1]!.vars.fl).toBe("38");
  });

  it("does not overwrite existing values in copy-forward", () => {
    const current = {
      studyKey: "ob-growth",
      organs: [
        { organ: "ob_bpd", pathology: null, pathologies: [] as string[], custom: false, text: "", vars: { bpd: "55" } },
      ],
      impressionOverride: null,
    };
    const prior = {
      studyKey: "ob-anomaly",
      organs: [
        { organ: "ob_bpd", pathology: null, pathologies: [] as string[], custom: false, text: "", vars: { bpd: "50" } },
      ],
      impressionOverride: null,
    };
    const { state, filledCount } = copyForwardMeasurements(current as any, prior as any);
    expect(filledCount).toBe(0);
    expect(state.organs[0]!.vars.bpd).toBe("55");
  });

  it("builds a diff between prior and current", () => {
    const current = {
      studyKey: "ob-growth",
      organs: [
        { organ: "ob_bpd", pathology: null, pathologies: [] as string[], custom: false, text: "", vars: { bpd: "55" } },
      ],
      impressionOverride: null,
    };
    const prior = {
      studyKey: "ob-anomaly",
      organs: [
        { organ: "ob_bpd", pathology: null, pathologies: [] as string[], custom: false, text: "", vars: { bpd: "50" } },
      ],
      impressionOverride: null,
    };
    const diff = copyForwardDiff(current as any, prior as any);
    expect(diff).toHaveLength(1);
    expect(diff[0]!.prior).toBe("50");
    expect(diff[0]!.current).toBe("55");
  });
});

// ── Measurement Validation ────────────────────────────────────────────────

describe("measurementValidation", () => {
  it("validates normal BPD value", () => {
    expect(validateMeasurement("bpd", "85").severity).toBe("ok");
  });

  it("flags impossible BPD value as error", () => {
    const result = validateMeasurement("bpd", "500");
    expect(result.severity).toBe("error");
    expect(result.message).toContain("typo");
  });

  it("flags zero value as error", () => {
    expect(validateMeasurement("bpd", "0").severity).toBe("error");
  });

  it("flags unusual but possible value as warning", () => {
    const result = validateMeasurement("bpd", "15");
    expect(result.severity).toBe("warning");
  });

  it("returns ok for unknown token", () => {
    expect(validateMeasurement("unknown_token", "50").severity).toBe("ok");
  });

  it("returns ok for non-numeric value", () => {
    expect(validateMeasurement("bpd", "abc").severity).toBe("ok");
  });

  it("validates kidney length", () => {
    expect(validateMeasurement("k1", "10").severity).toBe("ok");
    expect(validateMeasurement("k1", "50").severity).toBe("error");
  });

  it("validates EFW", () => {
    expect(validateMeasurement("efw", "1500").severity).toBe("ok");
    expect(validateMeasurement("efw", "20000").severity).toBe("error");
  });

  it("provides CSS classes for validation states", () => {
    expect(validationClass("error")).toContain("red");
    expect(validationClass("warning")).toContain("amber");
    expect(validationClass("ok")).toBe("");
  });

  it("validates all measurements in a state", () => {
    const organs = [
      { organ: "ob_bpd", vars: { bpd: "85", fl: "500" } },
    ];
    const results = validateAllMeasurements(organs);
    expect(results["ob_bpd.bpd"].severity).toBe("ok");
    expect(results["ob_bpd.fl"].severity).toBe("error");
  });
});

// ── Text Expansion ────────────────────────────────────────────────────────

describe("textExpansion", () => {
  it("matches 'fatty1' to Fatty Liver Gr I", () => {
    const match = matchSnippet("fatty1");
    expect(match).not.toBeNull();
    expect(match!.pathologyKey).toBe("liver-fatty-g1");
  });

  it("matches 'stone' to Cholelithiasis", () => {
    const match = matchSnippet("stone");
    expect(match).not.toBeNull();
    expect(match!.pathologyKey).toBe("gb_cholelithiasis");
  });

  it("matches case-insensitively", () => {
    const match = matchSnippet("FATTY1");
    expect(match).not.toBeNull();
    expect(match!.pathologyKey).toBe("liver-fatty-g1");
  });

  it("matches prefix (3+ chars)", () => {
    const match = matchSnippet("fat");
    expect(match).not.toBeNull();
  });

  it("returns null for no match", () => {
    expect(matchSnippet("xyz123")).toBeNull();
    expect(matchSnippet("")).toBeNull();
  });

  it("returns all snippets for display", () => {
    const snippets = getAllSnippets();
    expect(snippets.length).toBeGreaterThan(10);
  });
});

// ── Growth Chart ──────────────────────────────────────────────────────────

describe("growthChart", () => {
  it("builds an EFW growth chart with curves", () => {
    const chart = buildGrowthChart("EFW", [{ gaWeeks: 20, value: 350 }]);
    expect(chart.parameter).toBe("EFW");
    expect(chart.unit).toBe("g");
    expect(chart.curves.length).toBeGreaterThan(0);
    expect(chart.plots).toHaveLength(1);
    expect(chart.plots[0]!.value).toBe(350);
  });

  it("estimates percentile for a normal value", () => {
    const chart = buildGrowthChart("EFW", [{ gaWeeks: 20, value: 460 }]);
    expect(chart.plots[0]!.percentile).not.toBeNull();
    expect(chart.plots[0]!.percentile).toBe(50);
  });

  it("detects below 10th percentile", () => {
    const chart = buildGrowthChart("EFW", [{ gaWeeks: 32, value: 1200 }]);
    expect(chart.below_10).toBe(true);
  });

  it("detects above 90th percentile", () => {
    const chart = buildGrowthChart("EFW", [{ gaWeeks: 32, value: 4000 }]);
    expect(chart.above_90).toBe(true);
  });

  it("builds BPD chart", () => {
    const chart = buildGrowthChart("BPD", [{ gaWeeks: 28, value: 73 }]);
    expect(chart.parameter).toBe("BPD");
    expect(chart.unit).toBe("mm");
  });
});

// ── Daily Summary ─────────────────────────────────────────────────────────

describe("dailySummary", () => {
  it("builds a summary from today's reports", () => {
    const today = new Date().toISOString();
    const reports = [
      { id: 1, scanDate: today, finalizedAt: today, status: "FINALIZED", studyKey: "wa-female", studyTitle: "Whole Abdomen", impression: "Normal study.", patientName: "Test", serialNo: 1 },
      { id: 2, scanDate: today, finalizedAt: null, status: "DRAFT", studyKey: "wa-male", studyTitle: "Whole Abdomen (M)", impression: "", patientName: "Test2", serialNo: null },
    ];
    const summary = buildDailySummary(reports);
    expect(summary.finalizedCount).toBe(1);
    expect(summary.draftCount).toBe(1);
    expect(summary.studyBreakdown).toHaveLength(1);
    expect(summary.studyBreakdown[0]!.count).toBe(1);
  });

  it("handles empty reports", () => {
    const summary = buildDailySummary([]);
    expect(summary.finalizedCount).toBe(0);
    expect(summary.draftCount).toBe(0);
  });

  it("calculates revenue from pricing", () => {
    const today = new Date().toISOString();
    const reports = [
      { id: 1, scanDate: today, finalizedAt: today, status: "FINALIZED", studyKey: "wa-female", studyTitle: "WA", impression: "", patientName: "T", serialNo: 1 },
      { id: 2, scanDate: today, finalizedAt: today, status: "FINALIZED", studyKey: "kub", studyTitle: "KUB", impression: "", patientName: "T2", serialNo: 2 },
    ];
    const pricing = { "wa-female": 500, "kub": 300 };
    const summary = buildDailySummary(reports, pricing);
    expect(summary.revenueEstimate).toBe(800);
  });
});

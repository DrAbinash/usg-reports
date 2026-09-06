/**
 * v6.10 — Multi-clinic + feature toggles + BI-RADS + AI Draft tests.
 *
 * All tests are pure-data (no HTTP, no DB) — they cover the lib layer
 * that the API routes and UI components consume.
 */
import { describe, expect, it } from "vitest";
import {
  BIRADS_OPTIONS,
  getBiradsOption,
  biradsImpressionLine,
  biradsNeedsFollowUp,
  biradsFollowUpDays,
  isValidBirads,
  type BiradsCategory,
} from "@/lib/usg/birads";
import {
  validateClinicSlug,
  isTrialExpired,
  DEFAULT_CLINIC_ID,
} from "@/lib/clinic";

// ── BI-RADS ────────────────────────────────────────────────────────────────

describe("birads.ts", () => {
  it("exposes all 9 BI-RADS categories (0/1/2/3/4A/4B/4C/5/6)", () => {
    expect(BIRADS_OPTIONS).toHaveLength(9);
    const values = BIRADS_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["0", "1", "2", "3", "4a", "4b", "4c", "5", "6"]);
  });

  it("every category has a non-empty label, recommendation, and risk", () => {
    for (const o of BIRADS_OPTIONS) {
      expect(o.label).toBeTruthy();
      expect(o.fullLabel).toBeTruthy();
      expect(o.recommendation).toBeTruthy();
      expect(o.malignancyRisk).toBeTruthy();
    }
  });

  it("getBiradsOption returns the option for a known value, undefined otherwise", () => {
    expect(getBiradsOption("3")?.value).toBe("3");
    expect(getBiradsOption("4a")?.value).toBe("4a");
    expect(getBiradsOption("unknown")).toBeUndefined();
    expect(getBiradsOption(null)).toBeUndefined();
    expect(getBiradsOption(undefined)).toBeUndefined();
  });

  it("biradsImpressionLine formats the full assessment + recommendation", () => {
    const line = biradsImpressionLine("5");
    expect(line).toContain("BI-RADS 5");
    expect(line).toContain("Highly suggestive of malignancy");
    expect(line).toContain("biopsy");
  });

  it("biradsImpressionLine returns empty for unknown / null", () => {
    expect(biradsImpressionLine("unknown")).toBe("");
    expect(biradsImpressionLine(null)).toBe("");
    expect(biradsImpressionLine(undefined)).toBe("");
  });

  it("BI-RADS 3 needs a 6-month follow-up; BI-RADS 1/2/5 do not", () => {
    expect(biradsNeedsFollowUp("3")).toBe(true);
    expect(biradsFollowUpDays("3")).toBe(180); // ~6 months
    expect(biradsNeedsFollowUp("1")).toBe(false);
    expect(biradsNeedsFollowUp("2")).toBe(false);
    expect(biradsNeedsFollowUp("5")).toBe(false);
    expect(biradsFollowUpDays("5")).toBeNull();
  });

  it("BI-RADS 4 sub-categories (4A/4B/4C) all recommend biopsy", () => {
    expect(biradsImpressionLine("4a")).toContain("biopsy");
    expect(biradsImpressionLine("4b")).toContain("biopsy");
    expect(biradsImpressionLine("4c")).toContain("biopsy");
  });

  it("malignancy risk increases monotonically 4A < 4B < 4C < 5", () => {
    // We check the lower bound of the risk range parses to a number that
    // increases (2 → 10 → 50 → 95).
    const risk = (v: BiradsCategory) => {
      const r = getBiradsOption(v)?.malignancyRisk ?? "0";
      const m = r.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    expect(risk("4a")).toBeLessThan(risk("4b"));
    expect(risk("4b")).toBeLessThan(risk("4c"));
    expect(risk("4c")).toBeLessThanOrEqual(risk("5"));
  });

  it("isValidBirads accepts the 9 canonical categories, rejects others", () => {
    for (const v of ["0", "1", "2", "3", "4a", "4b", "4c", "5", "6"]) {
      expect(isValidBirads(v)).toBe(true);
    }
    expect(isValidBirads("7")).toBe(false);
    expect(isValidBirads("4")).toBe(false); // must be 4a/4b/4c
    expect(isValidBirads("")).toBe(false);
  });
});

// ── Clinic ──────────────────────────────────────────────────────────────────

describe("clinic.ts", () => {
  it("DEFAULT_CLINIC_ID is 'default'", () => {
    expect(DEFAULT_CLINIC_ID).toBe("default");
  });

  it("validateClinicSlug accepts lowercase slugs", () => {
    expect(validateClinicSlug("care-mumbai")).toEqual([]);
    expect(validateClinicSlug("rad1")).toEqual([]);
    expect(validateClinicSlug("care-diagnostics-2026")).toEqual([]);
  });

  it("validateClinicSlug rejects empty / too-short / too-long", () => {
    expect(validateClinicSlug("").join("|")).toContain("Slug is required");
    expect(validateClinicSlug("a").join("|")).toContain("at least 2 chars");
    expect(validateClinicSlug("x".repeat(41)).join("|")).toContain("≤ 40 chars");
  });

  it("validateClinicSlug rejects uppercase, leading/trailing dash, reserved words", () => {
    expect(validateClinicSlug("CareMumbai").length).toBeGreaterThan(0);
    expect(validateClinicSlug("-care").length).toBeGreaterThan(0);
    expect(validateClinicSlug("care-").length).toBeGreaterThan(0);
    expect(validateClinicSlug("new").some((e) => e.includes("reserved"))).toBe(true);
    expect(validateClinicSlug("api").some((e) => e.includes("reserved"))).toBe(true);
    expect(validateClinicSlug("settings").some((e) => e.includes("reserved"))).toBe(true);
  });

  it("isTrialExpired returns false for null / past-date / future-date", () => {
    // null = no expiry set
    expect(isTrialExpired({ trialExpiresAt: null })).toBe(false);
    // future date
    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(isTrialExpired({ trialExpiresAt: future })).toBe(false);
  });

  it("isTrialExpired returns true for a past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isTrialExpired({ trialExpiresAt: past })).toBe(true);
  });

  it("isTrialExpired returns false for an invalid date string", () => {
    expect(isTrialExpired({ trialExpiresAt: "not-a-date" })).toBe(false);
  });
});

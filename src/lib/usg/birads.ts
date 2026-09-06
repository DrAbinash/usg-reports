/**
 * birads.ts (v6.10) — BI-RADS assessment category for breast USG.
 *
 * ACR BI-RADS (Breast Imaging Reporting and Data System) 5th edition:
 *   0 — Incomplete: need additional imaging
 *   1 — Negative
 *   2 — Benign finding
 *   3 — Probably benign (6-month follow-up)
 *   4 — Suspicious (4A/4B/4C subcategories) — biopsy
 *   5 — Highly suggestive of malignancy — biopsy
 *   6 — Known biopsy-proven malignancy
 *
 * The assessment drives the recommendation (follow-up vs biopsy vs none),
 * which prints in the impression. The doctor picks the category from a
 * dropdown; this lib provides the labels, recommendations, and follow-up
 * interval.
 */

export type BiradsCategory = "0" | "1" | "2" | "3" | "4a" | "4b" | "4c" | "5" | "6";

export type BiradsOption = {
  value: BiradsCategory;
  label: string;
  fullLabel: string;
  recommendation: string;
  followUpDays?: number; // when set, suggests a follow-up reminder
  malignancyRisk: string;
};

export const BIRADS_OPTIONS: BiradsOption[] = [
  {
    value: "0",
    label: "BI-RADS 0",
    fullLabel: "BI-RADS 0 — Incomplete assessment",
    recommendation: "Additional imaging evaluation needed.",
    malignancyRisk: "—",
  },
  {
    value: "1",
    label: "BI-RADS 1",
    fullLabel: "BI-RADS 1 — Negative",
    recommendation: "Routine screening follow-up.",
    malignancyRisk: "0%",
  },
  {
    value: "2",
    label: "BI-RADS 2",
    fullLabel: "BI-RADS 2 — Benign finding",
    recommendation: "Routine screening follow-up.",
    malignancyRisk: "0%",
  },
  {
    value: "3",
    label: "BI-RADS 3",
    fullLabel: "BI-RADS 3 — Probably benign",
    recommendation: "Short-interval follow-up (6 months).",
    followUpDays: 180,
    malignancyRisk: "0–2%",
  },
  {
    value: "4a",
    label: "BI-RADS 4A",
    fullLabel: "BI-RADS 4A — Low suspicion",
    recommendation: "Tissue diagnosis (biopsy).",
    malignancyRisk: "2–9%",
  },
  {
    value: "4b",
    label: "BI-RADS 4B",
    fullLabel: "BI-RADS 4B — Moderate suspicion",
    recommendation: "Tissue diagnosis (biopsy).",
    malignancyRisk: "10–49%",
  },
  {
    value: "4c",
    label: "BI-RADS 4C",
    fullLabel: "BI-RADS 4C — High suspicion",
    recommendation: "Tissue diagnosis (biopsy).",
    malignancyRisk: "50–94%",
  },
  {
    value: "5",
    label: "BI-RADS 5",
    fullLabel: "BI-RADS 5 — Highly suggestive of malignancy",
    recommendation: "Tissue diagnosis (biopsy) — appropriate action mandatory.",
    malignancyRisk: "≥95%",
  },
  {
    value: "6",
    label: "BI-RADS 6",
    fullLabel: "BI-RADS 6 — Known biopsy-proven malignality",
    recommendation: "Surgical excision / treatment as indicated.",
    malignancyRisk: "100%",
  },
];

export function getBiradsOption(value: string | null | undefined): BiradsOption | undefined {
  return BIRADS_OPTIONS.find((o) => o.value === value);
}

/** Generate the impression line for a BI-RADS category. */
export function biradsImpressionLine(value: string | null | undefined): string {
  const opt = getBiradsOption(value);
  if (!opt) return "";
  return `${opt.fullLabel}. ${opt.recommendation}`;
}

/** Is this category one that should trigger a follow-up reminder? */
export function biradsNeedsFollowUp(value: string | null | undefined): boolean {
  return getBiradsOption(value)?.followUpDays != null;
}

/** Get the follow-up interval in days (null if none). */
export function biradsFollowUpDays(value: string | null | undefined): number | null {
  return getBiradsOption(value)?.followUpDays ?? null;
}

/** Validate a BI-RADS value. */
export function isValidBirads(value: string): boolean {
  return BIRADS_OPTIONS.some((o) => o.value === value);
}

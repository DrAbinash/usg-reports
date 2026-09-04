/**
 * measurementValidation.ts — validate measurement values against clinical ranges.
 *
 * Feature 2: Flag impossible or unusual values (BPD 200mm instead of 85mm,
 * kidney 0.5cm instead of 10cm). Shows a red border + tooltip so the
 * doctor catches typos before printing.
 */

export type ValidationResult = {
  valid: boolean;
  severity: "error" | "warning" | "ok";
  message?: string;
  expectedRange?: string;
};

type Range = { min: number; max: number; unit: string; label: string };

/**
 * Clinical measurement ranges by token key.
 * Values outside these ranges trigger a warning; values far outside trigger an error.
 *
 * These are approximate clinical ranges, not diagnostic thresholds —
 * the goal is to catch typos, not to second-guess the radiologist.
 */
const RANGES: Record<string, Range> = {
  // Obstetric biometry (mm)
  bpd: { min: 20, max: 100, unit: "mm", label: "BPD" },
  hc: { min: 50, max: 350, unit: "mm", label: "HC" },
  ac: { min: 50, max: 380, unit: "mm", label: "AC" },
  fl: { min: 10, max: 85, unit: "mm", label: "FL" },
  crl: { min: 2, max: 90, unit: "mm", label: "CRL" },
  nt: { min: 0.5, max: 5, unit: "mm", label: "NT" },
  efw: { min: 10, max: 6000, unit: "g", label: "EFW" },
  fhr: { min: 80, max: 200, unit: "bpm", label: "FHR" },

  // Abdominal (cm)
  l1: { min: 5, max: 25, unit: "cm", label: "Liver span" },
  s1: { min: 3, max: 20, unit: "cm", label: "Spleen" },
  c1: { min: 1, max: 15, unit: "mm", label: "CBD" },
  gw: { min: 0.5, max: 15, unit: "mm", label: "GB wall" },
  ps: { min: 1, max: 30, unit: "mm", label: "Polyp size" },

  // Kidney (cm)
  k1: { min: 5, max: 16, unit: "cm", label: "Kidney length" },
  r1: { min: 5, max: 16, unit: "cm", label: "RK length" },

  // Prostate (cc or cm)
  pv: { min: 5, max: 150, unit: "cc", label: "Prostate volume" },
  p1: { min: 1, max: 10, unit: "cm", label: "Prostate dim" },

  // Thyroid (mm)
  t1: { min: 1, max: 80, unit: "mm", label: "Thyroid dim" },

  // Uterus (cm)
  u1: { min: 2, max: 15, unit: "cm", label: "Uterus dim" },
  et: { min: 1, max: 25, unit: "mm", label: "Endometrium" },

  // Ovary (cm)
  o1: { min: 0.5, max: 12, unit: "cm", label: "Ovary dim" },

  // AFI (cm)
  afi: { min: 0, max: 40, unit: "cm", label: "AFI" },

  // Stone size (cm)
  size: { min: 0.1, max: 5, unit: "cm", label: "Stone size" },
  s1_stone: { min: 0.1, max: 5, unit: "cm", label: "Stone (smallest)" },
  s2_stone: { min: 0.1, max: 5, unit: "cm", label: "Stone (largest)" },
};

/** Tolerance factor — values outside range × this factor are "errors". */
const ERROR_FACTOR = 2.5;

/**
 * Validate a measurement value against its clinical range.
 *
 * @param tokenKey — the variable token name (e.g. "bpd", "l1")
 * @param value — the entered value as a string
 * @returns validation result with severity + message
 */
export function validateMeasurement(tokenKey: string, value: string): ValidationResult {
  const range = RANGES[tokenKey];
  if (!range) return { valid: true, severity: "ok" };

  const n = parseFloat(value);
  if (!Number.isFinite(n)) return { valid: true, severity: "ok" };
  if (n <= 0) {
    return {
      valid: false,
      severity: "error",
      message: `${range.label}: value must be positive`,
      expectedRange: `${range.min}–${range.max} ${range.unit}`,
    };
  }

  const errorMin = range.min / ERROR_FACTOR;
  const errorMax = range.max * ERROR_FACTOR;

  if (n < errorMin || n > errorMax) {
    return {
      valid: false,
      severity: "error",
      message: `${range.label} = ${n} ${range.unit} — likely a typo (expected ${range.min}–${range.max} ${range.unit})`,
      expectedRange: `${range.min}–${range.max} ${range.unit}`,
    };
  }

  if (n < range.min || n > range.max) {
    return {
      valid: true,
      severity: "warning",
      message: `${range.label} = ${n} ${range.unit} — unusual but possible (typical: ${range.min}–${range.max} ${range.unit})`,
      expectedRange: `${range.min}–${range.max} ${range.unit}`,
    };
  }

  return { valid: true, severity: "ok" };
}

/**
 * Validate all measurements in a composer state.
 * Returns a map of "organKey.varKey" → ValidationResult.
 */
export function validateAllMeasurements(
  organs: Array<{ organ: string; vars: Record<string, string> }>,
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};
  for (const organ of organs) {
    for (const [varKey, value] of Object.entries(organ.vars)) {
      if (!value) continue;
      const key = `${organ.organ}.${varKey}`;
      results[key] = validateMeasurement(varKey, value);
    }
  }
  return results;
}

/** CSS classes for validation severity. */
export function validationClass(severity: ValidationResult["severity"]): string {
  switch (severity) {
    case "error":
      return "border-red-500 ring-1 ring-red-300 bg-red-50";
    case "warning":
      return "border-amber-400 ring-1 ring-amber-200 bg-amber-50";
    case "ok":
      return "";
  }
}

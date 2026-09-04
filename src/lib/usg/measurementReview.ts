/**
 * measurementReview.ts — measurement confidence + review gate.
 *
 * When "Pull from machine" fills biometry slots from DICOM SR, the values
 * enter the composer silently. This module adds a review layer:
 *
 *   1. Each extracted measurement gets a confidence score (high/medium/low)
 *      based on whether the SR provided a clean numeric value with a
 *      recognised unit.
 *   2. The composer surfaces a review panel BEFORE committing values —
 *      the sonologist can accept all, reject individual fields, or
 *      hand-correct any value.
 *   3. Only accepted values enter the composer's variable slots.
 *
 * Ported + simplified from CARE ERP's usgExtraction confidence model.
 */

import type { SrMeasurement } from "./srExtract";
import type { SrExtractResult } from "./srExtract";

export type MeasurementConfidence = "high" | "medium" | "low" | "unmapped";

export type ReviewedMeasurement = {
  organ: string;
  varKey: string;
  value: string;
  unit: string;
  confidence: MeasurementConfidence;
  source: "dicom_sr" | "ocr" | "manual";
  accepted: boolean;
};

export type MeasurementReviewSet = {
  measurements: ReviewedMeasurement[];
  totalMatched: number;
  totalAccepted: number;
  hasLowConfidence: boolean;
};

/** Score one measurement's confidence from its raw SR fields. */
export function scoreConfidence(
  conceptName: string,
  rawValue: string,
  unit: string,
): MeasurementConfidence {
  const n = Number(rawValue);
  if (!Number.isFinite(n) || n <= 0) return "low";
  const hasUnit = unit && unit.trim().length > 0;
  const hasConcept = conceptName && conceptName.trim().length > 0;

  // High: clean numeric + unit + concept name
  if (hasUnit && hasConcept) return "high";
  // Medium: numeric + concept name but no unit (common — GE SRs sometimes omit)
  if (hasConcept) return "medium";
  // Low: numeric but no concept name
  return "low";
}

/** Build a reviewable set from an SR extraction result. */
export function buildReviewSet(
  srResult: SrExtractResult,
  srMeasurements: SrMeasurement[],
): MeasurementReviewSet {
  const measurements: ReviewedMeasurement[] = [];
  let hasLow = false;

  for (const [organ, vars] of Object.entries(srResult.vars)) {
    for (const [varKey, value] of Object.entries(vars)) {
      // Find the matching SR measurement for confidence scoring
      const srMatch = srMeasurements.find(
        (m) => m.conceptName && value.includes(m.value),
      );
      const concept = srMatch?.conceptName ?? "";
      const unit = srMatch?.unit ?? "";
      const confidence = scoreConfidence(concept, value, unit);
      if (confidence === "low") hasLow = true;

      measurements.push({
        organ,
        varKey,
        value,
        unit,
        confidence,
        source: "dicom_sr",
        accepted: confidence !== "low", // auto-accept high + medium; low needs manual review
      });
    }
  }

  // Include unmapped extras as low-confidence review items
  for (const [concept, display] of Object.entries(srResult.extras)) {
    const parts = display.split(/\s+/);
    const value = parts[0] ?? "";
    const unit = parts.slice(1).join(" ");
    measurements.push({
      organ: "_unmapped",
      varKey: concept,
      value,
      unit,
      confidence: "low",
      source: "dicom_sr",
      accepted: false,
    });
    hasLow = true;
  }

  const totalAccepted = measurements.filter((m) => m.accepted).length;

  return {
    measurements,
    totalMatched: measurements.length,
    totalAccepted,
    hasLowConfidence: hasLow,
  };
}

/** Toggle acceptance of one measurement. */
export function toggleAccept(
  set: MeasurementReviewSet,
  index: number,
): MeasurementReviewSet {
  const measurements = set.measurements.map((m, i) =>
    i === index ? { ...m, accepted: !m.accepted } : m,
  );
  return {
    ...set,
    measurements,
    totalAccepted: measurements.filter((m) => m.accepted).length,
  };
}

/** Update a measurement value (manual correction). */
export function updateValue(
  set: MeasurementReviewSet,
  index: number,
  value: string,
): MeasurementReviewSet {
  const measurements: ReviewedMeasurement[] = set.measurements.map((m, i) =>
    i === index ? { ...m, value, confidence: "high" as MeasurementConfidence, source: "manual" as const, accepted: true } : m,
  );
  return {
    ...set,
    measurements,
    totalAccepted: measurements.filter((m) => m.accepted).length,
  };
}

/** Accept all measurements (one-click accept). */
export function acceptAll(set: MeasurementReviewSet): MeasurementReviewSet {
  const measurements = set.measurements.map((m) => ({ ...m, accepted: true }));
  return {
    ...set,
    measurements,
    totalAccepted: measurements.length,
    hasLowConfidence: false,
  };
}

/** Reject all measurements (cancel the pull). */
export function rejectAll(set: MeasurementReviewSet): MeasurementReviewSet {
  const measurements = set.measurements.map((m) => ({ ...m, accepted: false }));
  return {
    ...set,
    measurements,
    totalAccepted: 0,
  };
}

/** Extract only the accepted values as a vars map for the composer. */
export function getAcceptedVars(
  set: MeasurementReviewSet,
): Record<string, Record<string, string>> {
  const vars: Record<string, Record<string, string>> = {};
  for (const m of set.measurements) {
    if (!m.accepted || m.organ === "_unmapped") continue;
    vars[m.organ] = vars[m.organ] ?? {};
    vars[m.organ][m.varKey] = m.value;
  }
  return vars;
}

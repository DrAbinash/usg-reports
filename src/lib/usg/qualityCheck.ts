/**
 * qualityCheck.ts — pre-finalize quality check gate.
 *
 * Before a report is finalized, this module checks for missing required
 * fields, incomplete measurements, and study-specific completeness rules.
 * The sonologist sees a checklist; missing items can be acknowledged or
 * fixed before finalize.
 *
 * Ported from CARE ERP's usgQualityCheck, simplified for the standalone
 * studio.
 */

import type { UsgComposerState } from "./types";
import type { UsgResolved } from "./types";
import { getStudy } from "./studies";

export type QualityCheckKind = "missing_measurement" | "missing_impression" | "missing_technique" | "incomplete_ob" | "incomplete_biometry" | "warning";

export type QualityCheckItem = {
  kind: QualityCheckKind;
  severity: "blocker" | "warning";
  message: string;
  organKey?: string;
  varKey?: string;
  /** If the check is acknowledged (dismissed by the sonologist). */
  acknowledged: boolean;
};

export type QualityCheckResult = {
  items: QualityCheckItem[];
  blockers: number;
  warnings: number;
  canFinalize: boolean;
};

/**
 * Run a quality check on the composer state before finalize.
 *
 * @param state — current composer state
 * @param resolved — resolved report (findings + impression)
 * @returns quality check result with blockers + warnings
 */
export function runQualityCheck(
  state: UsgComposerState,
  resolved: UsgResolved,
): QualityCheckResult {
  const items: QualityCheckItem[] = [];

  // 1. Check if impression is empty
  if (resolved.impression.length === 0 || resolved.impression.every((l) => !l.trim())) {
    items.push({
      kind: "missing_impression",
      severity: "blocker",
      message: "Impression is empty. Add findings or select a pathology before finalizing.",
      acknowledged: false,
    });
  }

  // 2. Check if technique is present
  if (!resolved.technique || !resolved.technique.trim()) {
    items.push({
      kind: "missing_technique",
      severity: "warning",
      message: "Technique section is empty.",
      acknowledged: false,
    });
  }

  // 3. Check for empty organ sections (organ selected but no text)
  for (const section of resolved.sections) {
    if (!section.text || !section.text.trim()) {
      items.push({
        kind: "warning",
        severity: "warning",
        message: `${section.label} section has no findings text.`,
        organKey: section.organ,
        acknowledged: false,
      });
    }
  }

  // 4. Obstetric-specific checks
  const study = getStudy(state.studyKey);
  if (study && state.studyKey.startsWith("ob-")) {
    const obChecks = runObstetricChecks(state, resolved);
    items.push(...obChecks);
  }

  // 5. Check for unfilled variable slots in pathology text
  for (const organ of state.organs) {
    if (!organ.pathologies || organ.pathologies.length === 0) continue;
    // Check if any {variable} tokens remain unsubstituted
    const unfilledMatch = organ.text.match(/\{[a-z0-9_]+\}/i);
    if (unfilledMatch && !organ.custom) {
      items.push({
        kind: "incomplete_biometry",
        severity: "warning",
        message: `${organ.organ}: variable "${unfilledMatch[0]}" is unfilled. Enter a value or remove the placeholder.`,
        organKey: organ.organ,
        acknowledged: false,
      });
    }
  }

  // 6. Early pregnancy: check for FH (fetal heart)
  if (state.studyKey.startsWith("ob-ep") || state.studyKey.startsWith("ob-nt")) {
    const hasFh = state.organs.some(
      (o) => o.pathologies && o.pathologies.length > 0 && o.text.toLowerCase().includes("cardiac activity"),
    );
    const hasFhNormal = resolved.impression.some((l) => l.toLowerCase().includes("cardiac activity") || l.toLowerCase().includes("live"));
    if (!hasFh && !hasFhNormal) {
      items.push({
        kind: "incomplete_ob",
        severity: "warning",
        message: "Fetal cardiac activity is not mentioned in the report.",
        acknowledged: false,
      });
    }
  }

  const blockers = items.filter((i) => i.severity === "blocker" && !i.acknowledged).length;
  const warnings = items.filter((i) => i.severity === "warning" && !i.acknowledged).length;

  return {
    items,
    blockers,
    warnings,
    // Can finalize if no unacknowledged blockers
    canFinalize: blockers === 0,
  };
}

/** Obstetric-specific quality checks. */
function runObstetricChecks(
  state: UsgComposerState,
  resolved: UsgResolved,
): QualityCheckItem[] {
  const items: QualityCheckItem[] = [];
  const allText = resolved.sections.map((s) => s.text).join(" ");
  const allImpression = resolved.impression.join(" ");

  // GA must be mentioned
  if (!/weeks|wk|ga\b|gestational/i.test(allText + " " + allImpression)) {
    items.push({
      kind: "incomplete_ob",
      severity: "warning",
      message: "Gestational age (GA) is not mentioned in the report.",
      acknowledged: false,
    });
  }

  // EDD must be mentioned for second/third trimester
  if (state.studyKey.includes("anomaly") || state.studyKey.includes("growth")) {
    if (!/edd|expected date/i.test(allText + " " + allImpression)) {
      items.push({
        kind: "incomplete_ob",
        severity: "warning",
        message: "EDD (expected date of delivery) is not mentioned.",
        acknowledged: false,
      });
    }
  }

  // Placenta position must be mentioned
  if (!/placenta/i.test(allText)) {
    items.push({
      kind: "incomplete_ob",
      severity: "warning",
      message: "Placental position is not mentioned in the findings.",
      acknowledged: false,
    });
  }

  // Liquor / AFI must be mentioned
  if (!/liquor|amniotic|afi/i.test(allText)) {
    items.push({
      kind: "incomplete_ob",
      severity: "warning",
      message: "Amniotic fluid (liquor/AFI) is not mentioned.",
      acknowledged: false,
    });
  }

  // Fetal presentation must be mentioned for third trimester
  if (state.studyKey.includes("growth") || state.studyKey.includes("doppler")) {
    if (!/presentation|cephalic|breech|transverse/i.test(allText)) {
      items.push({
        kind: "incomplete_ob",
        severity: "warning",
        message: "Fetal presentation is not mentioned.",
        acknowledged: false,
      });
    }
  }

  return items;
}

/** Acknowledge (dismiss) a quality check item. */
export function acknowledgeItem(
  result: QualityCheckResult,
  index: number,
): QualityCheckResult {
  const items = result.items.map((item, i) =>
    i === index ? { ...item, acknowledged: true } : item,
  );
  const blockers = items.filter((i) => i.severity === "blocker" && !i.acknowledged).length;
  const warnings = items.filter((i) => i.severity === "warning" && !i.acknowledged).length;
  return { items, blockers, warnings, canFinalize: blockers === 0 };
}

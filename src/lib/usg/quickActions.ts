/**
 * quickActions.ts — one-tap workflow shortcuts.
 *
 * Feature 1: One-tap "Normal Study" — marks every organ normal.
 * Feature 1b: Peak-time "Normal · no sizes" — same, but uses measurement-free
 *             normal wording (e.g. NP liver without MCL span) so rush reports
 *             print without filling {span}/{u1} slots.
 *
 * Feature 3: Smart copy-forward — when duplicating a follow-up, auto-fills
 * ALL measurement slots from the prior scan's state. The doctor only
 * adjusts what changed.
 */

import type { UsgComposerState, UsgOrganDef, UsgStudyDef } from "./types";
import { selectedPathologies, setOrganVar } from "./composer";

const TOKEN_RE = /\{[a-zA-Z0-9_]+\}/;

/**
 * Derive measurement-free normal prose from a measured normal.
 * Prefer `def.normalQuick` when authored; otherwise drop sentences that
 * contain `{fill-in}` slots (keeps qualitative "appears normal…" lines).
 */
export function unmeasuredNormalText(def: Pick<UsgOrganDef, "normal" | "normalQuick">): string {
  const quick = def.normalQuick?.trim();
  if (quick) return quick;

  const normal = def.normal ?? "";
  if (!TOKEN_RE.test(normal)) return normal;

  // Split on sentence boundaries; keep lines that don't ask for a measurement.
  const sentences = normal.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const kept = sentences.filter((s) => !TOKEN_RE.test(s));
  if (kept.length > 0) return kept.join(" ").trim();

  // Whole block was measurement-bound (e.g. "Measures {t1} X {t2} mm.") —
  // strip tokens rather than print "___".
  return normal
    .replace(/\s*\{[a-zA-Z0-9_]+\}\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

/** True when this organ's normal wording asks for size/measurement fill-ins. */
export function organNormalHasMeasurements(def: Pick<UsgOrganDef, "normal" | "vars" | "normalQuick">): boolean {
  if (def.normalQuick) return true; // authored quick variant ⇒ measured default exists
  if (TOKEN_RE.test(def.normal ?? "")) return true;
  return (def.vars?.length ?? 0) > 0 && TOKEN_RE.test(def.normal ?? "");
}

/** Studies where skipping measurements is clinically unsafe (OB biometry etc.). */
export function studyAllowsRushNormals(study: Pick<UsgStudyDef, "key" | "group" | "pcpndt">): boolean {
  // Obstetric biometry / early pregnancy CRL must keep measurement slots.
  if (study.pcpndt) return false;
  if (study.key === "ob" || study.key === "ep" || study.key.startsWith("ob-")) return false;
  if (study.key === "echo" || study.key.startsWith("echo")) return false;
  return true;
}

/**
 * Feature 1: Mark all organs as normal (clear all pathologies).
 * Applies the study's normal wording (measured form by default).
 */
export function markAllNormal(
  state: UsgComposerState,
  study?: UsgStudyDef | null,
  opts?: { omitMeasurements?: boolean },
): UsgComposerState {
  const omit = !!opts?.omitMeasurements;
  const byKey = new Map((study?.organs ?? []).map((d) => [d.key, d]));

  return {
    ...state,
    organs: state.organs.map((o) => {
      const def = byKey.get(o.organ);
      const text = def
        ? omit
          ? unmeasuredNormalText(def)
          : def.normal
        : o.text;
      return {
        ...o,
        pathology: null,
        pathologies: [],
        custom: false,
        text,
        // Peak mode clears stale size values so they can't leak into print.
        vars: omit ? {} : o.vars,
      };
    }),
    impressionOverride: null,
  };
}

/**
 * Peak-time helper — all-normal report with measurement-free wording.
 * Returns null when the study must keep measurement slots (OB / echo).
 */
export function applyRushNormalStudy(
  state: UsgComposerState,
  study: UsgStudyDef,
): UsgComposerState | null {
  if (!studyAllowsRushNormals(study)) return null;
  return markAllNormal(state, study, { omitMeasurements: true });
}

/**
 * One organ → measurement-free normal (chip: "Normal · no size").
 */
export function applyOrganQuickNormal(
  state: UsgComposerState,
  organKey: string,
  def: UsgOrganDef,
): UsgComposerState {
  const text = unmeasuredNormalText(def);
  return {
    ...state,
    organs: state.organs.map((o) =>
      o.organ === organKey
        ? {
            ...o,
            pathology: null,
            pathologies: [],
            custom: false,
            text,
            vars: {},
          }
        : o,
    ),
  };
}

/**
 * Feature 1: Check if the study is already all-normal.
 */
export function isAllNormal(state: UsgComposerState): boolean {
  return state.organs.every(
    (o) => !o.custom && selectedPathologies(o).length === 0,
  );
}

/**
 * Feature 3: Smart copy-forward — fill all measurement slots from a prior scan.
 *
 * Takes the prior report's state and copies every {variable} value into the
 * current state's matching organ slots. Only fills slots that are currently
 * empty (doesn't overwrite values the doctor already entered).
 */
export function copyForwardMeasurements(
  currentState: UsgComposerState,
  priorState: UsgComposerState,
): { state: UsgComposerState; filledCount: number } {
  let next = currentState;
  let filledCount = 0;

  for (const priorOrgan of priorState.organs) {
    const currentOrgan = next.organs.find((o) => o.organ === priorOrgan.organ);
    if (!currentOrgan) continue;

    for (const [varKey, value] of Object.entries(priorOrgan.vars)) {
      // Only fill if the current slot is empty
      if (currentOrgan.vars[varKey]) continue;
      if (!value) continue;
      next = setOrganVar(next, priorOrgan.organ, varKey, value);
      filledCount++;
    }
  }

  return { state: next, filledCount };
}

/**
 * Feature 3: Build a diff summary for the copy-forward panel.
 * Shows what changed between the prior scan and the current draft.
 */
export function copyForwardDiff(
  currentState: UsgComposerState,
  priorState: UsgComposerState,
): Array<{ organ: string; varKey: string; prior: string; current: string | null }> {
  const changes: Array<{ organ: string; varKey: string; prior: string; current: string | null }> = [];

  for (const priorOrgan of priorState.organs) {
    const currentOrgan = currentState.organs.find((o) => o.organ === priorOrgan.organ);
    if (!currentOrgan) continue;

    for (const [varKey, priorValue] of Object.entries(priorOrgan.vars)) {
      if (!priorValue) continue;
      const currentValue = currentOrgan.vars[varKey] ?? null;
      if (currentValue !== priorValue) {
        changes.push({
          organ: priorOrgan.organ,
          varKey,
          prior: priorValue,
          current: currentValue,
        });
      }
    }
  }

  return changes;
}

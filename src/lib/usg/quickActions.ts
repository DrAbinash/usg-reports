/**
 * quickActions.ts — one-tap workflow shortcuts.
 *
 * Feature 1: One-tap "Normal Study" — marks every organ normal, generates
 * the report, and opens the print dialog in one action.
 *
 * Feature 3: Smart copy-forward — when duplicating a follow-up, auto-fills
 * ALL measurement slots from the prior scan's state. The doctor only
 * adjusts what changed.
 */

import type { UsgComposerState, UsgStudyDef } from "./types";
import { getStudy, initialState } from "./studies";
import { selectedPathologies, setOrganVar } from "./composer";

/**
 * Feature 1: Mark all organs as normal (clear all pathologies).
 * Returns a new state where every organ has no pathology selected.
 */
export function markAllNormal(state: UsgComposerState): UsgComposerState {
  return {
    ...state,
    organs: state.organs.map((o) => ({
      ...o,
      pathology: null,
      pathologies: [],
      custom: false,
      text: "", // will be filled by the resolver with the normal text
    })),
    impressionOverride: null,
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

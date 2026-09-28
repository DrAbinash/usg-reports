/**
 * Free-text addendum helpers for impression / advice triad lines.
 * Pure — never invents patient data; dedupes exact trimmed lines.
 */
import { substitute } from "./composer";
import type { UsgComposerState, UsgOrganState } from "./types";

/** Append one or more lines to a newline-joined addendum blob. */
export function appendAddendumLines(
  prev: string | undefined | null,
  lines: string | string[],
): string {
  const incoming = (Array.isArray(lines) ? lines : [lines])
    .map((l) => l.trim())
    .filter(Boolean);
  if (!incoming.length) return (prev ?? "").trim();
  const existing = (prev ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const seen = new Set(existing);
  for (const line of incoming) {
    if (!seen.has(line)) {
      existing.push(line);
      seen.add(line);
    }
  }
  return existing.join("\n");
}

/**
 * Promote an organ's current finding text into impressionAddendum.
 * Uses substituted text (measurements filled). Splits on blank lines so
 * multi-paragraph custom findings become separate impression lines.
 */
export function promoteOrganTextToImpression(
  state: UsgComposerState,
  organKey: string,
  selection?: string | null,
): UsgComposerState {
  const organ = state.organs.find((o) => o.organ === organKey);
  if (!organ) return state;
  const raw = (selection?.trim() || organ.text || "").trim();
  if (!raw) return state;
  const substituted = substitute(raw, organ.vars, organKey).trim();
  if (!substituted) return state;
  const chunks = substituted
    .split(/\n\s*\n/)
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // Single paragraph → one line; multi-paragraph → one line each.
  const lines = chunks.length > 1 ? chunks : [substituted.replace(/\s+/g, " ").trim()];
  return {
    ...state,
    impressionAddendum: appendAddendumLines(state.impressionAddendum, lines),
  };
}

/** Promote free text into adviceAddendum. */
export function promoteTextToAdvice(
  state: UsgComposerState,
  text: string,
): UsgComposerState {
  const t = text.trim();
  if (!t) return state;
  return {
    ...state,
    adviceAddendum: appendAddendumLines(state.adviceAddendum, t),
  };
}

/** True when organ body was hand-edited (should bold on print + allow promote). */
export function organHasManualFinding(o: UsgOrganState): boolean {
  return !!o.custom && !!(o.text ?? "").trim();
}

/** Sentinel organ keys for clinic-wide reusable impression / advice chips. */
export const SNIPPET_ORGAN_IMPRESSION = "_impression";
export const SNIPPET_ORGAN_ADVICE = "_advice";

export function isSnippetOrgan(organKey: string): boolean {
  return organKey === SNIPPET_ORGAN_IMPRESSION || organKey === SNIPPET_ORGAN_ADVICE;
}

/**
 * USG Studio — follow-up diff (v5 phase 2).
 *
 * When a follow-up draft is opened (duplicated from a previous report), this
 * module compares the previous scan's composer state against the current one
 * so the doctor sees at a glance what changed between visits:
 *
 *   • measurement deltas per organ token ("Liver span (MCL): 14.2 → 15.6 cm")
 *   • pathology chips added / cleared since the last scan
 *   • hand-edited wording changes per organ (truncated previews)
 *   • impression line changes
 *
 * Pure functions only — safe on the server, in tests and in the browser.
 */
import { getStudy } from "./studies";
import { selectedPathologies, makeLookup } from "./composer";
import type { UsgComposerState, UsgPathologyDef, UsgVarDef } from "./types";

export type DiffMeasurement = {
  organLabel: string;
  token: string;
  label: string;
  unit?: string;
  from: string;
  to: string;
};

export type DiffPathologyChange = {
  organLabel: string;
  label: string;
};

export type DiffFinding = {
  organLabel: string;
  from: string;
  to: string;
};

export type UsgReportDiff = {
  measurements: DiffMeasurement[];
  addedPathologies: DiffPathologyChange[];
  clearedPathologies: DiffPathologyChange[];
  findings: DiffFinding[];
  impression: { from: string[]; to: string[] } | null;
};

const EMPTY_DIFF: UsgReportDiff = {
  measurements: [],
  addedPathologies: [],
  clearedPathologies: [],
  findings: [],
  impression: null,
};

/** "14.2" and "14.20" are the same measurement to a sonologist. */
function sameValue(a: string, b: string): boolean {
  const ta = (a ?? "").trim();
  const tb = (b ?? "").trim();
  if (ta === tb) return true;
  const na = Number(ta);
  const nb = Number(tb);
  if (ta && tb && !Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return false;
}

function prettify(token: string): string {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function varLabel(defs: UsgVarDef[] | undefined, token: string): { label: string; unit?: string } {
  const v = defs?.find((d) => d.key === token);
  return v ? { label: v.label, unit: v.unit } : { label: prettify(token) };
}

/** Var definitions for an organ — the same resolution the organ card uses. */
function organVarDefs(
  state: UsgComposerState,
  organKey: string,
  lookup: (key: string) => UsgPathologyDef | undefined,
): UsgVarDef[] | undefined {
  const study = getStudy(state.studyKey);
  const def = study?.organs.find((o) => o.key === organKey);
  const organ = state.organs.find((o) => o.organ === organKey);
  const selected = selectedPathologies(organ ?? { pathology: null })
    .map((k) => lookup(k))
    .filter((p): p is UsgPathologyDef => !!p);
  if (selected.length) return selected.find((p) => p.vars?.length)?.vars ?? selected[0].vars;
  return def?.vars;
}

const truncate = (s: string, n = 96) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Compute the previous-vs-current diff. Organs are matched by key, so the
 * diff survives a study switch (only shared organs compare; the rest count
 * as new). Returns EMPTY_DIFF when there is nothing to compare against.
 */
export function computeDiff(
  prev: UsgComposerState | null | undefined,
  next: UsgComposerState,
  pathologies: UsgPathologyDef[] = [],
  prevImpressionLines: string[] | null = null,
): UsgReportDiff {
  if (!prev || !Array.isArray(prev.organs)) return EMPTY_DIFF;
  const lookup = makeLookup(pathologies);

  const measurements: DiffMeasurement[] = [];
  const addedPathologies: DiffPathologyChange[] = [];
  const clearedPathologies: DiffPathologyChange[] = [];
  const findings: DiffFinding[] = [];

  const nextStudy = getStudy(next.studyKey);
  const prevStudy = getStudy(prev.studyKey);

  for (const cur of next.organs) {
    const prevOrgan = prev.organs.find((o) => o && o.organ === cur.organ);
    const organLabel =
      nextStudy?.organs.find((o) => o.key === cur.organ)?.label ??
      prevStudy?.organs.find((o) => o.key === cur.organ)?.label ??
      prettify(cur.organ);

    // Measurement deltas — every token present on either side.
    const prevVars = prevOrgan?.vars ?? {};
    const tokens = new Set([...Object.keys(cur.vars ?? {}), ...Object.keys(prevVars)]);
    const defs = organVarDefs(next, cur.organ, lookup) ?? organVarDefs(prev, cur.organ, lookup);
    for (const token of tokens) {
      const from = (prevVars[token] ?? "").trim();
      const to = (cur.vars[token] ?? "").trim();
      if (sameValue(from, to)) continue;
      if (!from && !to) continue;
      const { label, unit } = varLabel(defs, token);
      measurements.push({ organLabel, token, label, unit, from, to });
    }

    // Pathology selection changes.
    const prevSel = selectedPathologies(prevOrgan ?? { pathology: null }).map((k) => lookup(k)?.label ?? k);
    const curSel = selectedPathologies(cur).map((k) => lookup(k)?.label ?? k);
    for (const l of curSel) if (!prevSel.includes(l)) addedPathologies.push({ organLabel, label: l });
    for (const l of prevSel) if (!curSel.includes(l)) clearedPathologies.push({ organLabel, label: l });

    // Wording changes (pre-substitution text — var changes don't move it).
    const prevText = (prevOrgan?.text ?? "").trim();
    const curText = (cur.text ?? "").trim();
    if (prevText && curText && prevText !== curText) {
      findings.push({ organLabel, from: truncate(prevText), to: truncate(curText) });
    }
  }

  // Impression lines (previous column frozen at finalization, current auto).
  let impression: UsgReportDiff["impression"] = null;
  if (prevImpressionLines && prevImpressionLines.length) {
    const curLines = (next.impressionOverride ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (curLines.length && curLines.join("\n") !== prevImpressionLines.join("\n")) {
      impression = { from: prevImpressionLines, to: curLines };
    }
  }

  return { measurements, addedPathologies, clearedPathologies, findings, impression };
}

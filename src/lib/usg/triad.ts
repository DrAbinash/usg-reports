/**
 * Linked triad helpers — finding chip → impression badge → advice badge.
 * Pure functions; clinic-wide wording overrides applied by key.
 */
import type {
  UsgComposerState,
  UsgPathologyDef,
  UsgStudyDef,
  UsgTriadLine,
} from "./types";
import { selectedPathologies, substitute, type PathologyLookup } from "./composer";
import { adviceForPathology, STUDY_NORMAL_ADVICE } from "./pathologyAdvice";

/** Clinic-wide pathology wording overrides (same pencil pattern as normals). */
export type PathologyWordingOverrides = {
  /** `${studyKey}:${organKey}:${pathologyKey}` → impression text */
  impressions: Record<string, string>;
  /** `${studyKey}:${organKey}:${pathologyKey}` → advice text */
  advice: Record<string, string>;
};

export function pathologyOverrideKey(
  studyKey: string,
  organKey: string,
  pathologyKey: string,
): string {
  return `${studyKey}:${organKey}:${pathologyKey}`;
}

/** Upper-abdomen prefix for the "Normal scan of upper abdomen." rule. */
const UPPER_KEYS = ["liver", "gb", "cbd", "pancreas", "spleen", "kidney_rt", "kidney_lt"];

function dedupePush(out: UsgTriadLine[], line: UsgTriadLine, dismissed: Set<string>) {
  if (!line.text.trim()) return;
  if (dismissed.has(line.text.trim())) return;
  if (out.some((x) => x.text === line.text)) return;
  out.push(line);
}

function isCosmetic(p: UsgPathologyDef): boolean {
  return (p.impression?.length ?? 0) === 0 && !p.titleFragment;
}

/**
 * Derive impression badges from selected pathologies (+ legacy override /
 * addendum / trailing organ normals). Matches resolve()'s structural rules
 * so chip → badge → print stay in lockstep; edits/dismiss apply on top.
 *
 * Precedence per pathology line: report edit > clinic override > catalog.
 */
export function deriveImpressions(
  state: UsgComposerState,
  study: UsgStudyDef,
  lookup: PathologyLookup,
  clinic?: PathologyWordingOverrides | null,
  mergedVars: Record<string, string> = {},
): UsgTriadLine[] {
  const dismissed = new Set(
    (state.dismissedImpressions ?? []).map((s) => s.trim()).filter(Boolean),
  );
  const edits = state.impressionEdits ?? {};
  const out: UsgTriadLine[] = [];

  // Legacy free-text override — single badge(s), ownership via edit/dismiss.
  if (state.impressionOverride?.trim()) {
    for (const raw of state.impressionOverride.split(/\n+/)) {
      const text = raw.trim();
      if (!text) continue;
      dedupePush(out, { text, pathologyKey: "", edited: false, legacy: true }, dismissed);
    }
    for (const raw of (state.impressionAddendum ?? "").split(/\n+/)) {
      const text = raw.trim();
      if (!text) continue;
      dedupePush(out, { text, pathologyKey: "", edited: false, addendum: true }, dismissed);
    }
    return out;
  }

  const pathologyLines: UsgTriadLine[] = [];
  const trailingLines: UsgTriadLine[] = [];
  let anyPathology = false;

  for (const o of state.organs) {
    const def = study.organs.find((d) => d.key === o.organ);
    const keys = selectedPathologies(o);
    if (keys.length) {
      for (const pk of keys) {
        const p = lookup(pk);
        if (!p) continue;
        if (!isCosmetic(p)) anyPathology = true;

        const clinicKey = pathologyOverrideKey(state.studyKey, o.organ, pk);
        const clinicText = clinic?.impressions?.[clinicKey]?.trim();
        const editedText = edits[pk]?.trim();
        // Report edit wins over clinic default over catalog.
        const baseLines = editedText
          ? [editedText]
          : clinicText
            ? [clinicText]
            : (p.impression ?? []).map((l) =>
                substitute(l, { ...mergedVars, ...o.vars }, o.organ),
              );
        for (const text of baseLines) {
          if (!text.trim()) continue;
          if (pathologyLines.some((x) => x.text === text.trim())) continue;
          pathologyLines.push({
            text: text.trim(),
            pathologyKey: pk,
            edited: !!(editedText || clinicText),
          });
        }
      }
    } else if (def?.normalImpression) {
      const text = substitute(def.normalImpression, mergedVars).trim();
      if (text) trailingLines.push({ text, pathologyKey: "", edited: false });
    }
  }

  let auto: UsgTriadLine[];
  if (!anyPathology) {
    auto = (study.allNormalImpression ?? []).map((l) => ({
      text: substitute(l, mergedVars).trim(),
      pathologyKey: "",
      edited: false,
    }));
  } else {
    auto = study.normalImpressionFirst
      ? [...trailingLines, ...pathologyLines]
      : [...pathologyLines];
    if (study.upperGroupNormalLine) {
      const upperAllNormal = study.organs
        .filter((d) => UPPER_KEYS.includes(d.key))
        .every(
          (d) =>
            selectedPathologies(
              state.organs.find((o) => o.organ === d.key) ?? { pathology: null },
            ).length === 0,
        );
      const hasNonUpper = study.organs.some((d) => !UPPER_KEYS.includes(d.key));
      if (upperAllNormal && hasNonUpper) {
        auto.unshift({
          text: study.upperGroupNormalLine,
          pathologyKey: "",
          edited: false,
        });
      }
    }
    if (!study.normalImpressionFirst) auto.push(...trailingLines);
  }

  for (const line of auto) dedupePush(out, line, dismissed);

  for (const raw of (state.impressionAddendum ?? "").split(/\n+/)) {
    const text = raw.trim();
    if (!text) continue;
    dedupePush(out, { text, pathologyKey: "", edited: false, addendum: true }, dismissed);
  }

  return out;
}

/** Derive advice / next-step badges from selected pathologies. */
export function deriveAdvice(
  state: UsgComposerState,
  study: UsgStudyDef,
  lookup: PathologyLookup,
  clinic?: PathologyWordingOverrides | null,
  mergedVars: Record<string, string> = {},
): UsgTriadLine[] {
  const dismissed = new Set(
    (state.dismissedAdvice ?? []).map((s) => s.trim()).filter(Boolean),
  );
  const edits = state.adviceEdits ?? {};
  const out: UsgTriadLine[] = [];

  let anyPathology = false;
  for (const o of state.organs) {
    const keys = selectedPathologies(o);
    for (const pk of keys) {
      const p = lookup(pk);
      if (!p) continue;
      if (isCosmetic(p)) continue;
      anyPathology = true;
      const clinicKey = pathologyOverrideKey(state.studyKey, o.organ, pk);
      const clinicText = clinic?.advice?.[clinicKey]?.trim();
      const editedText = edits[pk]?.trim();
      const base = editedText
        ? [editedText]
        : clinicText
          ? [clinicText]
          : adviceForPathology(pk, p).map((l) =>
              substitute(l, { ...mergedVars, ...o.vars }, o.organ),
            );
      for (const text of base) {
        dedupePush(
          out,
          {
            text: text.trim(),
            pathologyKey: pk,
            edited: !!(editedText || clinicText),
          },
          dismissed,
        );
      }
    }
  }

  if (!anyPathology) {
    const studyAdvice =
      study.defaultSuggestions?.length
        ? study.defaultSuggestions
        : STUDY_NORMAL_ADVICE[state.studyKey] ?? [];
    for (const l of studyAdvice) {
      const text = substitute(l, mergedVars).trim();
      dedupePush(out, { text, pathologyKey: "", edited: false }, dismissed);
    }
  }

  return out;
}

/** Attach catalog advice onto pathology defs (non-destructive). */
export function enrichPathologyAdvice(p: UsgPathologyDef): UsgPathologyDef {
  if (p.advice?.length) return p;
  const fromCatalog = adviceForPathology(p.key, p);
  if (!fromCatalog.length) return p;
  return { ...p, advice: fromCatalog };
}

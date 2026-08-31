/**
 * USG Studio — pure composer.
 *
 * The one rule that defines this module (the doctor's own organ-slot rule):
 * selecting a pathology replaces ONLY that organ's finding text; every other
 * organ keeps its normal line; the impression recomposes automatically from
 * what is selected — pathology lines first (in organ order), then the
 * doctor's trailing normal-summary lines.
 */
import type { UsgComposerState, UsgOrganDef, UsgOrganState, UsgPathologyDef, UsgResolved, UsgStudyDef } from "./types";
import { getStudy, initialState, USG_STUDIES } from "./studies";

/** Tokens auto-derived from an organ key (kidney_rt → right/Right). */
const ORGAN_SIDE: Record<string, { side: string; Side: string }> = {
  kidney_rt: { side: "right", Side: "Right" },
  kidney_lt: { side: "left", Side: "Left" },
};

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** All {tokens} used by a text, in order of first appearance. */
export function extractTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/**
 * Substitute {tokens}: user-filled values win, then organ-side tokens
 * ({side}/{Side} for split kidneys), anything left renders as a fill-in
 * blank "___" so a printed report can never carry a stray token.
 */
export function substitute(
  text: string,
  vars: Record<string, string>,
  organKey?: string,
): string {
  const side = organKey ? ORGAN_SIDE[organKey] : undefined;
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, token: string) => {
    const v = vars[token];
    if (v && v.trim()) return v.trim();
    // Capitalised twin of a filled token ({Position} ⇆ {position})
    const lower = token.charAt(0).toLowerCase() + token.slice(1);
    const lv = vars[lower];
    if (lv && lv.trim()) return capitalise(lv.trim());
    if (side && side[token as keyof typeof side]) return side[token as keyof typeof side];
    return "___";
  });
}

/** Custom pathologies arrive from the DB; builtin set merges on top. */
export type PathologyLookup = (key: string) => UsgPathologyDef | undefined;

export function makeLookup(extra: UsgPathologyDef[] = []): PathologyLookup {
  const map = new Map<string, UsgPathologyDef>();
  for (const p of extra) map.set(p.key, p);
  return (key) => map.get(key);
}

/** Normalise arbitrary JSON (DB row / client payload) into a valid state. */
export function normaliseState(raw: unknown, fallbackStudy = "wa-female"): UsgComposerState {
  const base = initialState(fallbackStudy);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<UsgComposerState>;
  const study = getStudy(obj.studyKey ?? "") ?? getStudy(fallbackStudy) ?? USG_STUDIES[0];
  const organs: UsgOrganState[] = study.organs.map((def) => {
    const incoming = Array.isArray(obj.organs)
      ? obj.organs.find((o) => o && typeof o === "object" && o.organ === def.key)
      : undefined;
    if (!incoming) {
      return { organ: def.key, pathology: null, custom: false, text: def.normal, vars: {} };
    }
    const text = typeof incoming.text === "string" && incoming.text.trim() ? incoming.text : def.normal;
    return {
      organ: def.key,
      pathology: typeof incoming.pathology === "string" ? incoming.pathology : null,
      custom: !!incoming.custom,
      text,
      vars: incoming.vars && typeof incoming.vars === "object" ? { ...incoming.vars } : {},
    };
  });
  return {
    studyKey: study.key,
    organs,
    impressionOverride:
      typeof obj.impressionOverride === "string" ? obj.impressionOverride : null,
  };
}

/** Switch study type. Pathology selections, manual edits and their filled
 *  measurements carry over; plain-normal organs reset to the new study's own
 *  normal wording (e.g. adult → child normals, with measurement slots). */
export function switchStudy(state: UsgComposerState, studyKey: string): UsgComposerState {
  if (state.studyKey === studyKey) return state;
  const target = getStudy(studyKey);
  if (!target) return state;
  const prev = new Map(state.organs.map((o) => [o.organ, o]));
  return {
    studyKey: target.key,
    organs: target.organs.map((def) => {
      const old = prev.get(def.key);
      if (old && (old.pathology || old.custom)) return { ...old };
      return { organ: def.key, pathology: null, custom: false, text: def.normal, vars: {} };
    }),
    impressionOverride: state.impressionOverride,
  };
}

/** Select a pathology for an organ (or null = back to normal). Already-typed
 *  measurement values survive the swap whenever the new wording uses the same
 *  token (e.g. AFI typed on a normal liquor line is kept for Oligohydramnios). */
export function applyPathology(
  state: UsgComposerState,
  organKey: string,
  pathologyKey: string | null,
  lookup: PathologyLookup,
): UsgComposerState {
  const study = getStudy(state.studyKey);
  if (!study) return state;
  const def = study.organs.find((o) => o.key === organKey);
  if (!def) return state;
  const isKidney = organKey === "kidney_rt" || organKey === "kidney_lt";
  const organs = state.organs.map((o) => {
    if (o.organ !== organKey) return o;
    const nextText = pathologyKey === null ? def.normal : lookup(pathologyKey)?.text;
    if (pathologyKey !== null) {
      const p = lookup(pathologyKey);
      const allowed = !!p && (p.organ === organKey || (isKidney && p.organ === "kidney"));
      if (!allowed) return o; // unknown or wrong-organ pathology — ignore
    }
    const kept: Record<string, string> = {};
    if (nextText) for (const t of extractTokens(nextText)) if (o.vars[t]?.trim()) kept[t] = o.vars[t];
    return { organ: organKey, pathology: pathologyKey, custom: false, text: nextText ?? def.normal, vars: kept };
  });
  return { ...state, organs };
}

/** Hand-edit an organ's text (locks it — chips show as "customised"). */
export function setOrganText(state: UsgComposerState, organKey: string, text: string): UsgComposerState {
  const organs = state.organs.map((o) => (o.organ === organKey ? { ...o, custom: true, text } : o));
  return { ...state, organs };
}

/** Set a variable value for an organ. */
export function setOrganVar(state: UsgComposerState, organKey: string, key: string, value: string): UsgComposerState {
  const organs = state.organs.map((o) =>
    o.organ === organKey ? { ...o, vars: { ...o.vars, [key]: value } } : o,
  );
  return { ...state, organs };
}

/** Organ definition for a state (label + normal for display). */
export function organDef(study: UsgStudyDef, organKey: string): UsgOrganDef | undefined {
  return study.organs.find((o) => o.key === organKey);
}

/** Pathologies available for an organ: builtin for the organ + kidney commons. */
export function pathologiesForOrgan(all: UsgPathologyDef[], organKey: string): UsgPathologyDef[] {
  const isKidney = organKey === "kidney_rt" || organKey === "kidney_lt";
  return all.filter((p) => p.organ === organKey || (isKidney && p.organ === "kidney"));
}

/** The upper-abdomen organ prefix used for the "Normal scan of upper abdomen." rule. */
const UPPER_KEYS = ["liver", "gb", "cbd", "pancreas", "spleen", "kidney_rt", "kidney_lt"];

/** Resolve the full printable report from a state. */
export function resolve(
  state: UsgComposerState,
  lookup: PathologyLookup,
  technique: string,
): UsgResolved {
  const study = getStudy(state.studyKey) ?? getStudy("wa-female")!;
  const sections: UsgResolved["sections"] = [];
  const pathologyLines: string[] = [];
  const trailingLines: string[] = [];
  const suggestions: string[] = [];
  const fragments: string[] = [];
  let anyPathology = false;

  // Obstetric impressions quote values typed on OTHER cards (mean GA lives on
  // the biometry card, the presentation line lives on the fetus card), so
  // impression lines substitute against the union of every organ's vars.
  const mergedVars: Record<string, string> = {};
  for (const o of state.organs) Object.assign(mergedVars, o.vars);

  for (const o of state.organs) {
    const def = organDef(study, o.organ);
    if (!def) continue;
    const text = substitute(o.text, o.vars, o.organ);
    sections.push({ organ: o.organ, label: def.label, text });

    const p = o.pathology ? lookup(o.pathology) : undefined;
    if (p) {
      // A wording variant with no impression lines and no title fragment is a
      // cosmetic swap (e.g. "No gross fetal congenital anomalies detected.") —
      // it must not turn a normal report into a pathological one.
      const cosmetic = p.impression.length === 0 && !p.titleFragment;
      if (!cosmetic) anyPathology = true;
      const lineVars = { ...mergedVars, ...o.vars };
      for (const line of p.impression) pathologyLines.push(substitute(line, lineVars, o.organ));
      for (const s of p.suggestions ?? []) if (!suggestions.includes(s)) suggestions.push(s);
      if (p.titleFragment) fragments.push(substitute(p.titleFragment, lineVars, o.organ));
    } else if (def.normalImpression) {
      trailingLines.push(substitute(def.normalImpression, mergedVars));
    }
  }

  // Impression rule (the doctor's pattern): pathology lines first in organ
  // order, then the trailing normal-summary lines; all-normal reports use the
  // study's normal impression; a fully-normal upper group in an otherwise
  // abnormal whole-abdomen report opens with "Normal scan of upper abdomen.".
  // Obstetric family (normalImpressionFirst): the leading normal line ("A
  // single live intrauterine fetus at 28 wk 05 days…") prints FIRST.
  let autoLines: string[];
  if (!anyPathology) {
    autoLines = study.allNormalImpression.map((l) => substitute(l, mergedVars));
  } else {
    autoLines = study.normalImpressionFirst
      ? [...trailingLines, ...pathologyLines]
      : [...pathologyLines];
    if (study.upperGroupNormalLine) {
      const upperAllNormal = study.organs
        .filter((d) => UPPER_KEYS.includes(d.key))
        .every((d) => !state.organs.find((o) => o.organ === d.key)?.pathology);
      const hasNonUpper = study.organs.some((d) => !UPPER_KEYS.includes(d.key));
      if (upperAllNormal && hasNonUpper) autoLines.unshift(study.upperGroupNormalLine);
    }
    if (!study.normalImpressionFirst) autoLines.push(...trailingLines);
  }

  const impression = state.impressionOverride?.trim()
    ? state.impressionOverride.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : autoLines;

  const finalSuggestions = anyPathology ? suggestions : study.defaultSuggestions ?? [];

  const title = fragments.length
    ? `${study.title} WITH ${fragments.map((f) => f.toUpperCase()).join(" AND ")}`
    : study.title;

  return { study, title, sections, impression, suggestions: finalSuggestions, technique };
}

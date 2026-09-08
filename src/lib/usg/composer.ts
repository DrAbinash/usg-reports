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
import { getTokenType } from "./tokenTypes";
import { getStudy, getStudyWithOverrides, initialState, USG_STUDIES, type NormalOverrides } from "./studies";
import { perParameterGa, meanGa, hadlockEfw, efwTolerance, eddFromGa } from "./biometry";
import { formatEdd } from "./lmp";

/** Tokens auto-derived from an organ key (kidney_rt → right/Right). */
export const ORGAN_SIDE: Record<string, { side: string; Side: string }> = {
  kidney_rt: { side: "right", Side: "Right" },
  kidney_lt: { side: "left", Side: "Left" },
  thyroid_rt: { side: "right", Side: "Right" },
  thyroid_lt: { side: "left", Side: "Left" },
  breast_rt: { side: "right", Side: "Right" },
  breast_lt: { side: "left", Side: "Left" },
  testis_rt: { side: "right", Side: "Right" },
  testis_lt: { side: "left", Side: "Left" },
  globe_rt: { side: "right", Side: "Right" },
  globe_lt: { side: "left", Side: "Left" },
  carotid_rt: { side: "right", Side: "Right" },
  carotid_lt: { side: "left", Side: "Left" },
  pleura_rt: { side: "right", Side: "Right" },
  pleura_lt: { side: "left", Side: "Left" },
};

/**
 * Shared side-agnostic pathology organs: an entry with organ "thyroid-lobe"
 * applies to BOTH thyroid_rt and thyroid_lt with {side}/{Side} filled from the
 * card it was clicked on — the kidney pattern generalised to every paired
 * structure (breast / testis / globe / carotid / pleura).
 */
const SIDE_SHARED: Record<string, string[]> = {
  kidney: ["kidney_rt", "kidney_lt"],
  "thyroid-lobe": ["thyroid_rt", "thyroid_lt"],
  breast: ["breast_rt", "breast_lt"],
  testis: ["testis_rt", "testis_lt"],
  globe: ["globe_rt", "globe_lt"],
  carotid: ["carotid_rt", "carotid_lt"],
  pleura: ["pleura_rt", "pleura_lt"],
};

/** True when a pathology (organ "x") may be applied to organKey. */
function pathologyAppliesTo(pathologyOrgan: string, organKey: string): boolean {
  if (pathologyOrgan === organKey) return true;
  return (SIDE_SHARED[pathologyOrgan] ?? []).includes(organKey);
}

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

/** Selected pathology keys of an organ state — `pathologies` (combined)
 *  wins, legacy single `pathology` falls back. Catalog/click order kept. */
export function selectedPathologies(o: Pick<UsgOrganState, "pathology" | "pathologies">): string[] {
  if (Array.isArray(o.pathologies)) {
    return o.pathologies.filter((k) => typeof k === "string" && k);
  }
  return o.pathology ? [o.pathology] : [];
}

/** Custom pathologies arrive from the DB; builtin set merges on top. */
export type PathologyLookup = (key: string) => UsgPathologyDef | undefined;

export function makeLookup(extra: UsgPathologyDef[] = []): PathologyLookup {
  const map = new Map<string, UsgPathologyDef>();
  for (const p of extra) map.set(p.key, p);
  return (key) => map.get(key);
}

/** Normalise arbitrary JSON (DB row / client payload) into a valid state. */
export function normaliseState(
  raw: unknown,
  fallbackStudy = "wa-female",
  overrides?: NormalOverrides | null,
): UsgComposerState {
  const base = initialState(fallbackStudy, overrides);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<UsgComposerState>;
  const study = getStudyWithOverrides(obj.studyKey ?? "", overrides) ?? getStudyWithOverrides(fallbackStudy, overrides) ?? USG_STUDIES[0];
  const organs: UsgOrganState[] = study.organs.map((def) => {
    const incoming = Array.isArray(obj.organs)
      ? (obj.organs.find((o) => o && typeof o === "object" && o.organ === def.key) as Partial<UsgOrganState> | undefined)
      : undefined;
    if (!incoming) {
      return { organ: def.key, pathology: null, pathologies: [], custom: false, text: def.normal, vars: {} };
    }
    const text = typeof incoming.text === "string" && incoming.text.trim() ? incoming.text : def.normal;
    const keys = selectedPathologies(incoming as UsgOrganState);
    return {
      organ: def.key,
      pathology: keys[0] ?? null, // legacy mirror of the combined list
      pathologies: keys,
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
export function switchStudy(
  state: UsgComposerState,
  studyKey: string,
  overrides?: NormalOverrides | null,
): UsgComposerState {
  if (state.studyKey === studyKey) return state;
  const target = getStudyWithOverrides(studyKey, overrides);
  if (!target) return state;
  const prev = new Map(state.organs.map((o) => [o.organ, o]));
  return {
    studyKey: target.key,
    organs: target.organs.map((def) => {
      const old = prev.get(def.key);
      if (old && (selectedPathologies(old).length || old.custom)) return { ...old };
      return { organ: def.key, pathology: null, pathologies: [], custom: false, text: def.normal, vars: {} };
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
  overrides?: NormalOverrides | null,
): UsgComposerState {
  return applyPathologies(state, organKey, pathologyKey === null ? [] : [pathologyKey], lookup, overrides);
}

/**
 * Combined findings — set the FULL pathology selection for one organ.
 *
 * One organ can carry several pathologies at once (fatty liver + haemangioma +
 * hepatomegaly…): the finding text concatenates each selected wording as its
 * own paragraph, the impression unions every line and the composed study
 * title joins every fragment. Unknown or wrong-organ keys are dropped, so a
 * stale key from an old draft can never corrupt a report. Typed measurement
 * values survive whenever any of the new texts uses the same token.
 */
export function applyPathologies(
  state: UsgComposerState,
  organKey: string,
  keys: string[],
  lookup: PathologyLookup,
  overrides?: NormalOverrides | null,
): UsgComposerState {
  const study = getStudyWithOverrides(state.studyKey, overrides);
  if (!study) return state;
  const def = study.organs.find((o) => o.key === organKey);
  if (!def) return state;
  const organs = state.organs.map((o) => {
    if (o.organ !== organKey) return o;
    // Keep click order; drop keys that no longer resolve or belong elsewhere.
    const defs = keys
      .map((k) => lookup(k))
      .filter((p): p is UsgPathologyDef => !!p && pathologyAppliesTo(p.organ, organKey));
    const nextKeys = [...new Set(defs.map((p) => p.key))];
    const nextText = nextKeys.length ? defs.map((p) => p.text).join("\n\n") : def.normal;
    const kept: Record<string, string> = {};
    for (const t of extractTokens(nextText)) if (o.vars[t]?.trim()) kept[t] = o.vars[t];
    return {
      organ: organKey,
      pathology: nextKeys[0] ?? null, // legacy mirror
      pathologies: nextKeys,
      custom: false,
      text: nextText,
      vars: kept,
    };
  });
  return { ...state, organs };
}

/** Hand-edit an organ's text (locks it — chips show as "customised"). */
export function setOrganText(state: UsgComposerState, organKey: string, text: string): UsgComposerState {
  const organs = state.organs.map((o) =>
    o.organ === organKey ? { ...o, custom: true, text, pathologies: selectedPathologies(o) } : o,
  );
  return { ...state, organs };
}

/** Set a variable value for an organ. */
export function setOrganVar(state: UsgComposerState, organKey: string, key: string, value: string): UsgComposerState {
  const organs = state.organs.map((o) =>
    o.organ === organKey ? { ...o, vars: { ...o.vars, [key]: value } } : o,
  );
  let next = { ...state, organs };
  // v6.13: auto-derive GA/EFW/EDD from BPD/HC/AC/FL when the biometry
  // organ's measurements change. This runs Hadlock automatically so the
  // doctor never has to use the separate calculator — just type the 4
  // measurements and the weeks/days/EDD/EFW fill themselves.
  if (organKey === "biometry" && ["bpd", "hc", "ac", "fl"].includes(key)) {
    next = deriveBiometry(next);
  }
  return next;
}

/** v6.13: Auto-derive GA weeks/days, EDD, and EFW from BPD/HC/AC/FL via
 *  Hadlock (1984/1985). Called automatically by setOrganVar when any of
 *  the 4 primary biometry measurements change. Also safe to call after
 *  Pull-from-machine applies SR vars. */
export function deriveBiometry(state: UsgComposerState, scanDate?: string): UsgComposerState {
  const bio = state.organs.find((o) => o.organ === "biometry");
  if (!bio || !bio.vars) return state;

  const mm = (v: string | undefined): number | undefined => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const bpd = mm(bio.vars.bpd);
  const hc = mm(bio.vars.hc);
  const ac = mm(bio.vars.ac);
  const fl = mm(bio.vars.fl);
  if (!bpd && !hc && !ac && !fl) return state;

  const cm = { bpd: bpd ?? 0, hc: hc ?? 0, ac: ac ?? 0, fl: fl ?? 0 };
  const vars = { ...bio.vars };
  const anyFilled = [bpd, hc, ac, fl].filter((v) => v != null).length;

  // Per-parameter GA (weeks + days for each filled measurement)
  if (anyFilled >= 1) {
    const per = perParameterGa(cm);
    if (bpd && per.bpd) { vars.bpdw = String(per.bpd.weeks); vars.bpdd = String(per.bpd.days); }
    if (hc && per.hc) { vars.hcw = String(per.hc.weeks); vars.hcd = String(per.hc.days); }
    if (ac && per.ac) { vars.acw = String(per.ac.weeks); vars.acd = String(per.ac.days); }
    if (fl && per.fl) { vars.flw = String(per.fl.weeks); vars.fld = String(per.fl.days); }

    // Mean GA (needs at least 2 of the 4 for a meaningful average)
    if (anyFilled >= 2) {
      const ga = meanGa(cm);
      if (ga) {
        vars.gaw = String(ga.weeks);
        vars.gad = String(ga.days);
        // EDD from mean GA
        const edd = eddFromGa(ga.weeks, ga.days, scanDate ? new Date(scanDate) : new Date());
        vars.edd = formatEdd(edd);
      }
    }
  }

  // EFW via Hadlock (needs at least BPD + AC, or all 4 for best accuracy)
  if (bpd && ac) {
    const efwResult = hadlockEfw(cm);
    if (efwResult.best) {
      vars.ewt = String(Math.round(efwResult.best.efw));
      vars.ewtd = String(efwTolerance(efwResult.best.efw));
    }
  }

  const organs = state.organs.map((o) => o.organ === "biometry" ? { ...o, vars } : o);
  return { ...state, organs };
}

/** Organ definition for a state (label + normal for display). */
export function organDef(study: UsgStudyDef, organKey: string): UsgOrganDef | undefined {
  return study.organs.find((o) => o.key === organKey);
}

/** Pathologies available for an organ: its own + shared side-organ commons. */
export function pathologiesForOrgan(all: UsgPathologyDef[], organKey: string): UsgPathologyDef[] {
  return all.filter((p) => pathologyAppliesTo(p.organ, organKey));
}

/** The upper-abdomen organ prefix used for the "Normal scan of upper abdomen." rule. */
const UPPER_KEYS = ["liver", "gb", "cbd", "pancreas", "spleen", "kidney_rt", "kidney_lt"];

/** Resolve the full printable report from a state. */
export function resolve(
  state: UsgComposerState,
  lookup: PathologyLookup,
  technique: string,
  overrides?: NormalOverrides | null,
): UsgResolved {
  const study = getStudyWithOverrides(state.studyKey, overrides) ?? getStudyWithOverrides("wa-female", overrides)!;
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

  // v6.12: apply select-token defaults. When a select token (like {lie}) has
  // no value (either the key is missing or the value is empty), use its first
  // option as the default. This means the antenatal scan prints "cephalic" by
  // default until the doctor picks a different lie from the dropdown.
  // We check BOTH the merged vars AND the declared organ vars — a var slot
  // declared on the organ but never filled by the doctor still needs its
  // default applied.
  const declaredVarKeys = new Set<string>();
  for (const o of study.organs) for (const v of o.vars ?? []) declaredVarKeys.add(v.key);
  for (const tokenKey of declaredVarKeys) {
    const val = mergedVars[tokenKey];
    if (!val || !val.trim()) {
      const tokenDef = getTokenType(tokenKey);
      if (tokenDef?.type === "select" && tokenDef.options && tokenDef.options.length > 0) {
        mergedVars[tokenKey] = tokenDef.options[0].value;
      }
    }
  }

  for (const o of state.organs) {
    const def = organDef(study, o.organ);
    if (!def) continue;
    // v6.12: merge declared select-token defaults into the organ's vars too,
    // so the organ text renders the default (e.g. "cephalic") even when the
    // doctor hasn't picked a lie yet.
    const organVars = { ...mergedVars, ...o.vars };
    const text = substitute(o.text, organVars, o.organ);
    sections.push({ organ: o.organ, label: def.label, text, kind: def.kind });

    // Combined findings: every selected pathology contributes its impression
    // lines, suggestions and title fragment — in click order, deduplicated.
    const selected = selectedPathologies(o)
      .map((k) => lookup(k))
      .filter((p): p is UsgPathologyDef => !!p);
    if (selected.length) {
      const lineVars = { ...mergedVars, ...o.vars };
      for (const p of selected) {
        // A wording variant with no impression lines and no title fragment is a
        // cosmetic swap (e.g. "No gross fetal congenital anomalies detected.") —
        // it must not turn a normal report into a pathological one.
        const cosmetic = p.impression.length === 0 && !p.titleFragment;
        if (!cosmetic) anyPathology = true;
        for (const line of p.impression) {
          const s = substitute(line, lineVars, o.organ);
          if (!pathologyLines.includes(s)) pathologyLines.push(s);
        }
        for (const s of p.suggestions ?? []) {
          const sub = substitute(s, lineVars, o.organ);
          if (!suggestions.includes(sub)) suggestions.push(sub);
        }
        if (p.titleFragment) {
          const f = substitute(p.titleFragment, lineVars, o.organ);
          if (!fragments.includes(f)) fragments.push(f);
        }
      }
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
        .every((d) => selectedPathologies(state.organs.find((o) => o.organ === d.key) ?? { pathology: null }).length === 0);
      const hasNonUpper = study.organs.some((d) => !UPPER_KEYS.includes(d.key));
      if (upperAllNormal && hasNonUpper) autoLines.unshift(study.upperGroupNormalLine);
    }
    if (!study.normalImpressionFirst) autoLines.push(...trailingLines);
  }

  const impression = state.impressionOverride?.trim()
    ? state.impressionOverride.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    : autoLines;

  const finalSuggestions = anyPathology ? suggestions : study.defaultSuggestions ?? [];

  // The study heading on the printed report stays as the study's own title
  // (e.g. "USG Whole Abdomen") — pathology findings (fatty changes,
  // pancreatitis, etc.) appear ONLY in the impression, never in the heading.
  // The fragments array is still collected (used for the report list subtitle
  // and search) but is NOT appended to the title.
  const title = study.title;

  return { study, title, sections, impression, suggestions: finalSuggestions, technique };
}

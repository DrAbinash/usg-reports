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
import {
  coerceGridRows,
  gridRowsToProse,
  initialGridRows,
  isGridOrgan,
  deriveGridScoreTotal,
} from "./gridOrgans";
import { getTokenType } from "./tokenTypes";
import { getStudy, getStudyWithOverrides, initialState, USG_STUDIES, type NormalOverrides } from "./studies";
import { perParameterGa, meanGa, hadlockEfw, efwTolerance, eddFromGa } from "./biometry";
import { formatEdd } from "./lmp";
import {
  deriveAdvice,
  deriveImpressions,
  type PathologyWordingOverrides,
} from "./triad";

export type { PathologyWordingOverrides };

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

/** Echo content engine: a chip authored on one echo card also offers on the
 *  equivalent card of the other adult echo formats (streamlined / peds). */
const ECHO_ORGAN_ALIASES: Record<string, string[]> = {
  "echo-chambers": ["echo-chambers", "echo-func"],
  "echo-others": ["echo-others", "echo-great-vessels"],
  // Pulmonary-pressure chips live wherever a format states pulmonary findings:
  // the adult OTHERS card and the pediatric FUNCTION card.
  "echo-pulmonary": ["echo-others", "echo-func"],
};

/** True when a pathology (organ "x") may be applied to organKey. */
function pathologyAppliesTo(pathologyOrgan: string, organKey: string): boolean {
  // Clinic impression/advice snippets never attach to body organ cards.
  if (pathologyOrgan === "_impression" || pathologyOrgan === "_advice") return false;
  if (pathologyOrgan === organKey) return true;
  if ((ECHO_ORGAN_ALIASES[pathologyOrgan] ?? []).includes(organKey)) return true;
  if ((ECHO_ORGAN_ALIASES[organKey] ?? []).includes(pathologyOrgan)) return true;
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

/** Normalise arbitrary JSON (DB row / client payload) into a valid state.
 *
 *  Grid organs (BPP):
 *    • incoming.rows → coerce to schema columns (in-memory only)
 *    • legacy prose only (no rows) → keep text; UI shows read-only banner
 *  Never invent rows for legacy prose on open — FINALIZED reportHtml /
 *  stateJson stay untouched until a draft is explicitly edited & saved.
 */
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
      return {
        organ: def.key,
        pathology: null,
        pathologies: [],
        custom: false,
        text: def.normal,
        vars: {},
        ...(isGridOrgan(def) ? { rows: initialGridRows(def) } : {}),
      };
    }
    const text = typeof incoming.text === "string" && incoming.text.trim() ? incoming.text : def.normal;
    const keys = selectedPathologies(incoming as UsgOrganState);
    const baseOrgan: UsgOrganState = {
      organ: def.key,
      pathology: keys[0] ?? null, // legacy mirror of the combined list
      pathologies: keys,
      custom: !!incoming.custom,
      text,
      vars: incoming.vars && typeof incoming.vars === "object" ? { ...incoming.vars } : {},
    };
    if (isGridOrgan(def) && def.grid) {
      const hasRows = Array.isArray(incoming.rows) && incoming.rows.length > 0;
      if (hasRows) {
        baseOrgan.rows = coerceGridRows(def.grid, incoming.rows);
      }
      // else: legacy prose — leave rows undefined so UI shows the banner
    }
    return baseOrgan;
  });
  const strArr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  const strMap = (v: unknown): Record<string, string> | undefined => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return Object.keys(out).length ? out : undefined;
  };
  return {
    studyKey: study.key,
    organs,
    impressionOverride:
      typeof obj.impressionOverride === "string" ? obj.impressionOverride : null,
    dismissedImpressions: strArr(obj.dismissedImpressions),
    dismissedAdvice: strArr(obj.dismissedAdvice),
    impressionEdits: strMap(obj.impressionEdits),
    adviceEdits: strMap(obj.adviceEdits),
    impressionAddendum:
      typeof obj.impressionAddendum === "string" ? obj.impressionAddendum : undefined,
    adviceAddendum:
      typeof obj.adviceAddendum === "string" ? obj.adviceAddendum : undefined,
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
      if (old && (selectedPathologies(old).length || old.custom || (old.rows && old.rows.length))) {
        return { ...old };
      }
      return {
        organ: def.key,
        pathology: null,
        pathologies: [],
        custom: false,
        text: def.normal,
        vars: {},
        ...(isGridOrgan(def) ? { rows: initialGridRows(def) } : {}),
      };
    }),
    impressionOverride: state.impressionOverride,
    dismissedImpressions: state.dismissedImpressions,
    dismissedAdvice: state.dismissedAdvice,
    impressionEdits: state.impressionEdits,
    adviceEdits: state.adviceEdits,
    impressionAddendum: state.impressionAddendum,
    adviceAddendum: state.adviceAddendum,
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
 * Echo content engine — shared conflict-group vocabulary.
 *
 * A pathology chip that declares `conflictGroup` + `findingsText` replaces
 * only the normal LINES of that slot (a slot "block" starts at a line whose
 * prefix matches below and runs until the next slot-start line), instead of
 * the whole organ. Two selected chips of the same group: the later click
 * wins (same-slot replacement). A group with no start line in the scaffold
 * is first tried as an inline phrase (ductus "No PDA.") and otherwise
 * appended. Removing the chip re-derives from `def.normal`, so undo always
 * restores the verbatim baseline.
 */
export const ECHO_SLOT_STARTS: Record<string, RegExp> = {
  situs: /^(Levo Cardiac Position|Viscero-[Aa]rterial Situs|Viscero-[Aa]trial Situs|Viscero atrial situs|Situs solitus, normal)/i,
  axis: /^The cardiac apex is towards/i,
  mv: /^(Mitral Valve|The AML show)/i,
  av: /^Aortic Valves?\b/i,
  tv: /^Tricuspid Valve\b/i,
  pv: /^Pulmonary Valve\b/i,
  ias: /^IAS\b/i,
  ivs: /^(IVS \( Interventricular Septum|IVS \( Internal septum|IVS-|The IVS appears to be intact)/i,
  pericardium: /^(Pericardium|No evidence of Pericardial)/i,
  clot: /^(LA \/ LVA Clot|No intracardiac Clot|No chamber clot|No obvious intra-cardiac clot|No vegetation or Effusion)/i,
  chambers: /^(No chamber dilatation|Chamber dimensions|Dilated (right atrium|RA)|Left Atrium|Right Atrium|Right Ventricle\b)/i,
  rwma: /^(Regional wall motion|No regional wall motion|Wall motion abnormality)/i,
  "pulmonary-pressure": /^(Normal pulmonary trunk|No evidence of Pulmonary Hypertension|Pulmonary arterial hypertension|Dilated pulmonary trunk)/i,
  rhythm: /^Sinus tachycardia/i,
  "lv-function": /^(Good LV & RV Systolic|Left Ventricle Ejection|LVEF|Normal LV|LV systolic function|Normal functioning cardiac valves)/i,
  "lv-wall": /^(Wall thickness|LV WALL DIMENSION|Hypertrophied LV wall|Mildly hypertrophied LV wall)/i,
  ductus: /^Ductus arteriosus is patent/i,
  "foramen-ovale": /^Foramen Ovale is visualized/i,
  "fetal-focus": /^A single live intrauterine fetus/i,
};

/** Phrases replaced inside a line when their slot group is selected. */
const ECHO_SLOT_INLINE: Record<string, RegExp> = {
  ductus: /No PDA\./,
};

function slotAwareOrganText(normal: string, defs: UsgPathologyDef[]): string {
  const slotDefs = defs.filter((p) => p.conflictGroup && p.findingsText?.trim());
  const wholeDefs = defs.filter((p) => !p.conflictGroup);
  if (!slotDefs.length) {
    return wholeDefs.length ? wholeDefs.map((p) => p.text).join("\n\n") : normal;
  }
  // Later click wins within one conflict group.
  const byGroup = new Map<string, UsgPathologyDef>();
  for (const p of slotDefs) byGroup.set(p.conflictGroup as string, p);

  const startOf = (line: string): string | null => {
    for (const [group, re] of Object.entries(ECHO_SLOT_STARTS)) {
      if (re.test(line)) return group;
    }
    return null;
  };

  const emitted = new Set<string>();
  const out: string[] = [];
  let dropBlock = false;
  for (const line of normal.split("\n")) {
    const group = startOf(line);
    if (group) {
      dropBlock = false;
      const chip = byGroup.get(group);
      if (chip) {
        if (!emitted.has(group)) {
          out.push(chip.findingsText as string);
          emitted.add(group);
        }
        dropBlock = true;
        continue;
      }
    } else if (dropBlock) {
      if (!line.trim() || SEPTA_ABBREV_RE.test(line.trim())) {
        // Blank lines end a block; the combined septa sentence is a
        // stand-alone finding and must never be swallowed as a sub-line.
        dropBlock = false;
        out.push(line);
      }
      continue; // block sub-line of a replaced slot
    }
    if (!dropBlock) out.push(line);
  }

  // Groups not present in the scaffold: inline phrase first, else append.
  const appended: string[] = [];
  for (const [group, chip] of byGroup) {
    if (emitted.has(group)) continue;
    const inline = ECHO_SLOT_INLINE[group];
    if (inline) {
      const joined = out.join("\n");
      if (inline.test(joined)) {
        const replaced = joined.replace(inline, chip.findingsText!.trim());
        return finishSlotText(replaced, wholeDefs);
      }
    }
    appended.push(chip.findingsText as string);
    emitted.add(group);
  }
  if (appended.length) out.push(...appended);
  return finishSlotText(out.join("\n"), wholeDefs);
}

function finishSlotText(text: string, wholeDefs: UsgPathologyDef[]): string {
  return wholeDefs.length ? `${text}\n\n${wholeDefs.map((p) => p.text).join("\n\n")}` : text;
}

/**
 * "No PDA / ASD / VSD." is a combined sentence the doctor edits by hand in
 * her signed reports. When a ductus/ias/ivs slot chip is selected anywhere
 * in the study, the abbreviation for that defect is removed from the line
 * (whole line dropped when nothing remains) — on every echo-format organ.
 *
 * Same cross-organ principle for chamber dilatation: a `chambers` chip is
 * seeded on ONE card per format, but the normal lines "No chamber
 * dilatation." / "<Chamber> :- Normal in size." never survive on the other
 * cards of the same report.
 */
const SEPTA_ABBREV_RE = /^No ((?:PDA|ASD|VSD)(?: \/ (?:PDA|ASD|VSD))*)\.$/;
const DILATATION_NORMAL_LINE_RE = /^(No chamber dilatation\.?|(Left Atrium|Right Atrium|Right Ventricle) :- Normal in size\.?)$/;
/** Only echo-format body cards carry this contradiction vocabulary. */
const ECHO_RECONCILE_CARDS = new Set([
  "echo-mmode",
  "echo-valves",
  "echo-others",
  "echo-chambers",
  "echo-func",
  "echo-great-vessels",
]);
function reconcileEchoCrossOrgan(organs: UsgComposerState["organs"], studyOrgans: { key: string; normal: string }[], lookup: PathologyLookup): UsgComposerState["organs"] {
  if (!organs.some((o) => ECHO_RECONCILE_CARDS.has(o.organ))) return organs;
  const groups = new Set<string>();
  for (const o of organs) {
    if (o.custom) continue;
    for (const k of selectedPathologies(o)) {
      const g = lookup(k)?.conflictGroup;
      if (g === "ductus" || g === "ias" || g === "ivs" || g === "chambers") groups.add(g);
    }
  }
  const wordGroup = (w: string) => (w === "PDA" ? "ductus" : w === "ASD" ? "ias" : "ivs");
  const dilated = groups.has("chambers");
  return organs.map((o) => {
    const def = studyOrgans.find((d) => d.key === o.organ);
    if (!def || o.custom || !ECHO_RECONCILE_CARDS.has(o.organ)) return o;
    // Deterministic rebuild: every card's text is re-derived from the study
    // normal + its own selected chips, so removing a chip on one card also
    // restores the contradiction lines it caused on the other cards.
    const ownDefs = selectedPathologies(o)
      .map((k) => lookup(k))
      .filter((p): p is NonNullable<typeof p> => !!p && pathologyAppliesTo(p.organ, o.organ));
    const base = ownDefs.length ? slotAwareOrganText(def.normal, ownDefs) : def.normal;
    const chipOnThisCard = ownDefs.some((k) => k.conflictGroup === "chambers");
    const nextLines: string[] = [];
    for (const l of base.split("\n")) {
      const t = l.trim();
      const septa = SEPTA_ABBREV_RE.exec(t);
      if (septa) {
        // Rebuild idempotently: keep only the defect words whose slot chip
        // is NOT selected anywhere (drop the line when none remain).
        const keep = septa[1].split(" / ").filter((w) => !groups.has(wordGroup(w)));
        if (keep.length) nextLines.push(`No ${keep.join(" / ")}.`);
        continue;
      }
      if (dilated && !chipOnThisCard && DILATATION_NORMAL_LINE_RE.test(t)) continue;
      nextLines.push(l);
    }
    const nextText = nextLines.join("\n");
    return nextText === o.text ? o : { ...o, text: nextText };
  });
}

/**
 * Echo content engine — apply a bundle of echo chips to one organ with
 * same-slot (conflictGroup) semantics. Keys already selected are dropped
 * (undo restores the verbatim baseline); new keys replace earlier keys of
 * the same slot group.
 */
export function applyMacroBundle(
  state: UsgComposerState,
  organKey: string,
  macroKeys: string[],
  lookup: PathologyLookup,
  overrides?: NormalOverrides | null,
): UsgComposerState {
  const study = getStudyWithOverrides(state.studyKey, overrides);
  if (!study) return state;
  const organ = state.organs.find((o) => o.organ === organKey);
  const current = organ ? selectedPathologies(organ) : [];
  const adding = macroKeys.filter((k) => !current.includes(k));
  const removing = new Set(macroKeys.filter((k) => current.includes(k)));
  const groupOf = (k: string) => lookup(k)?.conflictGroup;
  const next = current.filter((k) => !removing.has(k) && !(groupOf(k) && adding.some((a) => groupOf(a) === groupOf(k))));
  return applyPathologies(state, organKey, [...next, ...adding], lookup, overrides);
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
    const nextText = nextKeys.length ? slotAwareOrganText(def.normal, defs) : def.normal;
    const kept: Record<string, string> = {};
    for (const t of extractTokens(nextText)) if (o.vars[t]?.trim()) kept[t] = o.vars[t];
    return {
      organ: organKey,
      pathology: nextKeys[0] ?? null, // legacy mirror
      pathologies: nextKeys,
      custom: false,
      text: nextText,
      vars: kept,
      ...(o.rows ? { rows: o.rows } : {}),
    };
  });
  return { ...state, organs: reconcileEchoCrossOrgan(organs, study.organs, lookup) };
}

/** Hand-edit an organ's text (locks it — chips show as "customised"). */
export function setOrganText(state: UsgComposerState, organKey: string, text: string): UsgComposerState {
  const organs = state.organs.map((o) =>
    o.organ === organKey ? { ...o, custom: true, text, pathologies: selectedPathologies(o) } : o,
  );
  return { ...state, organs };
}

/** Replace structured grid rows for an organ (BPP scores etc.). */
export function setOrganRows(
  state: UsgComposerState,
  organKey: string,
  rows: UsgOrganState["rows"],
): UsgComposerState {
  const study = getStudy(state.studyKey);
  const def = study?.organs.find((o) => o.key === organKey);
  const organs = state.organs.map((o) => {
    if (o.organ !== organKey) return o;
    const next = { ...o, rows, custom: true };
    if (def && rows?.length) {
      next.text = gridRowsToProse(def, rows);
    }
    return next;
  });
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

/**
 * Same sort ChipRow / UsgOrganCard use for the visible chip strip:
 * when preferNoSizeChips, ·no-size keys float to the front.
 * Hotkeys 1–9 MUST index this array (not raw pathologiesForOrgan order).
 */
export function sortPathologiesForChips(
  pathologies: UsgPathologyDef[],
  preferNoSizeChips = false,
): UsgPathologyDef[] {
  if (!preferNoSizeChips) return pathologies;
  return [...pathologies].sort((a, b) => {
    const an = /-nosize$/.test(a.key) ? 0 : 1;
    const bn = /-nosize$/.test(b.key) ? 0 : 1;
    return an - bn;
  });
}

/** Resolve the full printable report from a state. */
export function resolve(
  state: UsgComposerState,
  lookup: PathologyLookup,
  technique: string,
  overrides?: NormalOverrides | null,
  pathologyWording?: PathologyWordingOverrides | null,
): UsgResolved {
  const study = getStudyWithOverrides(state.studyKey, overrides) ?? getStudyWithOverrides("wa-female", overrides)!;
  const sections: UsgResolved["sections"] = [];
  const fragments: string[] = [];

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

    if (isGridOrgan(def) && def.grid && o.rows && o.rows.length) {
      const total = def.grid.scoreTotal
        ? {
            value: deriveGridScoreTotal(o.rows, def.grid.scoreTotal.columnKey),
            max: def.grid.scoreTotal.max,
          }
        : undefined;
      const prose = gridRowsToProse(def, o.rows);
      const chipAbnormal = selectedPathologies(o).length > 0;
      const scoreAbnormal =
        !!total && typeof total.max === "number" && total.value < total.max;
      sections.push({
        organ: o.organ,
        label: def.label,
        text: prose,
        kind: "grid",
        abnormal: chipAbnormal || scoreAbnormal,
        normalText: def.normal,
        grid: {
          columns: def.grid.columns,
          rows: o.rows,
          total,
          twinLabel: /twin-?a|_a$/i.test(o.organ) ? "Fetus-A" : /twin-?b|_b$/i.test(o.organ) ? "Fetus-B" : undefined,
        },
      });
    } else {
      const text = substitute(o.text, organVars, o.organ);
      sections.push({
        organ: o.organ,
        label: def.label,
        text,
        kind: def.kind === "grid" ? "rows" : def.kind,
        abnormal: selectedPathologies(o).length > 0 || !!o.custom,
        normalText: def.normal,
      });
    }

    // Title fragments only — impression / advice come from the triad helpers.
    const selected = selectedPathologies(o)
      .map((k) => lookup(k))
      .filter((p): p is UsgPathologyDef => !!p);
    for (const p of selected) {
      if (p.titleFragment) {
        const f = substitute(p.titleFragment, { ...mergedVars, ...o.vars }, o.organ);
        if (!fragments.includes(f)) fragments.push(f);
      }
    }
  }

  const impressionLines = deriveImpressions(state, study, lookup, pathologyWording, mergedVars);
  const adviceLines = deriveAdvice(state, study, lookup, pathologyWording, mergedVars);
  const impression = impressionLines.map((l) => l.text);
  const advice = adviceLines.map((l) => l.text);

  // The study heading on the printed report stays as the study's own title
  // (e.g. "USG Whole Abdomen") — pathology findings (fatty changes,
  // pancreatitis, etc.) appear ONLY in the impression, never in the heading.
  // The fragments array is still collected (used for the report list subtitle
  // and search) but is NOT appended to the title.
  const title = study.title;

  return {
    study,
    title,
    sections,
    impression,
    advice,
    suggestions: advice,
    technique,
    impressionLines,
    adviceLines,
  };
}

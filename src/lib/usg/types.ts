/**
 * USG Studio — shared types.
 *
 * The whole composer is a pure, serialisable state object so it can live in
 * UsgReport.stateJson, be recomputed at any time, and never depend on the
 * database for rendering.
 */

/** One variable slot inside a finding text, e.g. {span} in "measures {span} cm". */
export type UsgVarDef = {
  key: string; // token name used in text: {key}
  label: string; // human label shown above the input
  unit?: string; // cm / mm / cc / gms — displayed as suffix
};

/** A quick-select pathology that replaces ONE organ's finding. */
export type UsgPathologyDef = {
  key: string; // stable key, e.g. "liver-fatty-g1"
  organ: string; // organ key it belongs to
  label: string; // chip label, e.g. "Fatty Liver — Gr I"
  category?: string; // grouping label in the chip row
  /** Finding text with {variable} tokens; replaces the organ's normal text. */
  text: string;
  /** Impression line(s) contributed when selected. May contain {variable} tokens. */
  impression: string[];
  /** Optional fragment for the composed study title ("grade i fatty changes"). */
  titleFragment?: string;
  /** Extra suggestion lines printed under the impression ("Suggested: Serum PSA"). */
  suggestions?: string[];
  vars?: UsgVarDef[];
  /** Builtins ship in code; customs are rows in the UsgPathology table. */
  builtin: boolean;
};

/** Definition of an organ slot inside a study (e.g. LIVER in whole abdomen). */
export type UsgOrganDef = {
  key: string; // "liver"
  label: string; // "LIVER" — printed finding subheading
  /** Normal finding text (may contain {variable} tokens for measured studies). */
  normal: string;
  /**
   * Peak-time / rush normal — same clinical meaning, NO size/measurement
   * slots. Used by "Normal · no sizes" so a normal liver prints without
   * forcing MCL span entry. Falls back to stripping `{token}` sentences
   * from `normal` when omitted.
   */
  normalQuick?: string;
  vars?: UsgVarDef[];
  /**
   * Impression line added when this organ is normal while some other organ
   * carries a pathology (the doctor's trailing summary lines, e.g.
   * "Bilateral adenexa normal in morphology.").
   */
  normalImpression?: string;
  /**
   * Print layout: "rows" (default) = label + prose row in the findings
   * table; "table" = each line of the text becomes a bordered measurement
   * row (label : value + normal range) — used by echocardiography M-mode
   * dimensions and any fixed measurement panel; "grid" = structured
   * repeatable-row table (BPP score, future follicular / fibroid maps).
   */
  kind?: "rows" | "table" | "grid";
  /** Column + fixed-row schema when kind === "grid". */
  grid?: UsgGridSchema;
};

/** One column in a grid organ (BPP Score, follicular day-table, …). */
export type UsgGridColumn = {
  key: string;
  label: string;
  type: "select" | "text";
  options?: { value: string; label: string }[];
};

/** Fixed clinical row for score-style grids (BPP components). */
export type UsgGridFixedRow = {
  id: string;
  label: string;
  normalDesc?: string;
  abnormalDesc?: string;
};

/** Schema attached to a grid organ definition. */
export type UsgGridSchema = {
  columns: UsgGridColumn[];
  fixedRows?: UsgGridFixedRow[];
  /** When set, print a bold Total row derived from this score column. */
  scoreTotal?: { columnKey: string; max: number };
};

/** One data row in a grid organ — cells keyed by column key. */
export type UsgGridRow = {
  id: string;
  cells: Record<string, string>;
};

/** A study type = ordered organ list + technique + impression defaults. */
export type UsgStudyDef = {
  key: string; // "wa-female"
  label: string; // "Whole Abdomen (Female)"
  title: string; // printed heading "USG WHOLE ABDOMEN"
  sex?: "F" | "M" | "ANY"; // default patient sex when picked ("ANY" = MSK / non-sexed)
  /** Dropdown grouping (STUDY_GROUPS key) — keeps 22 studies scannable. */
  group?: string;
  technique: string;
  organs: UsgOrganDef[];
  /** Impression lines when every organ is normal. */
  allNormalImpression: string[];
  /** Suggestion lines printed under the impression of an all-normal report. */
  defaultSuggestions?: string[];
  /**
   * Obstetric family: the leading normal line ("A single live intrauterine
   * fetus at 28 wk 05 days…") prints BEFORE pathology lines — the opposite
   * of the whole-abdomen family where pathology lines come first.
   */
  normalImpressionFirst?: boolean;
  /** PC-PNDT: print the mandatory sex-determination declaration block. */
  pcpndt?: boolean;
  /**
   * Line inserted when all "upper" organs (liver→kidneys) are normal but the
   * report carries a lower/pelvic pathology — the doctor's
   * "Normal scan of upper abdomen." pattern.
   */
  upperGroupNormalLine?: string;
};

/** Patient sex value for the child profile (prints as "Child"). */
export const USG_SEX_CHILD = "CHILD";

/** Runtime state of one organ in a report. */
export type UsgOrganState = {
  organ: string; // organ key
  /**
   * Selected pathology key, or null = normal. LEGACY mirror of the FIRST
   * entry in `pathologies` — kept so drafts saved by earlier versions (and
   * every single-pathology code path) keep working unchanged.
   */
  pathology: string | null;
  /**
   * Combined findings: ALL selected pathology keys for this organ, in
   * catalog order. An organ can be fatty AND haemangioma AND hepatomegaly
   * at once — the finding text concatenates each, the impression and the
   * study title union them. Absent/empty = normal organ.
   */
  pathologies?: string[];
  /** True once the doctor hand-edited the resolved text. */
  custom: boolean;
  /** Hand-edited or pathology/normal text BEFORE variable substitution. */
  text: string;
  /** Filled variable values by token key. */
  vars: Record<string, string>;
  /**
   * Structured grid rows when the organ def has kind === "grid".
   * Absent on legacy prose saves — UI shows a read-only legacy banner;
   * FINALIZED reports are never rewritten on open.
   */
  rows?: UsgGridRow[];
};

/** Complete composer state persisted as UsgReport.stateJson. */
export type UsgComposerState = {
  studyKey: string;
  organs: UsgOrganState[];
  /** Manual impression override (null = auto-compose). */
  impressionOverride: string | null;
};

/** Resolved report ready for printing. */
export type UsgResolved = {
  study: UsgStudyDef;
  title: string; // composed study title with pathology fragments
  sections: {
    organ: string;
    label: string;
    text: string;
    kind?: "rows" | "table" | "grid";
    /** Structured grid payload for print (BPP etc.). */
    grid?: {
      columns: UsgGridColumn[];
      rows: UsgGridRow[];
      /** Derived total — never stored in stateJson. */
      total?: { value: number; max: number };
      twinLabel?: string;
    };
  }[];
  impression: string[];
  suggestions: string[];
  technique: string;
};

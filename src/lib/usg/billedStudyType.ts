/**
 * billedStudyType.ts — billing-desk procedure → USG study-type resolution.
 *
 * PRIMARY source of truth when a bill-desk row exists. Returns:
 *   • StudyTypeKey — known USG report format family (incl. "echo" after Echo template seed)
 *   • "unmapped"   — billed procedure has no USG format → block auto-bootstrap
 *   • null         — no billed procedure string → fall back to DICOM / manual as today
 *
 * Resolve from bill-desk **test code** (catalog id, e.g. ECHO / USG W) and/or
 * **test name**. Code is tried first — short codes often fail name heuristics.
 *
 * Override the default table via settings key `usg_billing_procedure_map`
 * (JSON object of uppercase procedure name → StudyTypeKey | "unmapped").
 */

/** Bill-desk identity: catalog code and/or display name. */
export type BillDeskTestRef = {
  testCode?: string | null;
  testName?: string | null;
  /** @deprecated alias for testName — kept for older call sites. */
  billedProcedure?: string | null;
};

export type StudyTypeKey =
  | "whole-abdomen"
  | "upper-abdomen"
  | "lower-abdomen"
  | "kub"
  | "tvs"
  | "ob"
  | "ep"
  | "thyroid"
  | "breast"
  | "scrotum"
  | "trus"
  | "cranium"
  | "orbit"
  | "chest"
  | "swelling"
  | "carotid"
  | "doppler-upper"
  | "doppler-lower"
  | "echo"
  | "fetal-echo"
  | "ob-bpp"
  | "ob-bpp-twin"
  | "ob-tiffa-4d"
  | "ob-tiffa-twin";

/** Settings key — JSON map stored on HospitalSettings.usgBillingProcedureMapJson. */
export const USG_BILLING_PROCEDURE_MAP_KEY = "usg_billing_procedure_map";

/**
 * What careSync writes as testName when a study arrives from Orthanc with no
 * DICOM StudyDescription. It is a display stand-in, NOT bill data — the CARE
 * catalog has no test called "USG Study".
 *
 * It has to stay out of resolution: a study that arrived in PACS first and got
 * its bill linked later keeps this string in testName, and feeding it to the
 * matcher produced "Billed: USG Study — no matching USG report format" for a
 * study the catalog actually covers (USG W = USG WHOLE ABDOMEN).
 */
export const UNNAMED_STUDY_PLACEHOLDER = "USG Study";

/** True when a name carries no real procedure information. */
export function isUnnamedStudyPlaceholder(name: string | null | undefined): boolean {
  const t = (name ?? "").trim();
  return t === "" || t.toUpperCase() === UNNAMED_STUDY_PLACEHOLDER.toUpperCase();
}

/**
 * Default procedure → study-type table (uppercase keys).
 * Includes bill-desk catalog **codes** (ECHO, USG W, …) and display names.
 * "echo" matches the seeded Echo — Adult M-Mode template's studyKey.
 */
export const DEFAULT_BILLING_PROCEDURE_MAP: Record<string, StudyTypeKey | "unmapped"> = {
  // ── Whole / upper / lower abdomen ──────────────────────────────────────
  "USG W": "whole-abdomen",
  "USG WHOLE ABDOMEN": "whole-abdomen",
  "WHOLE ABDOMEN": "whole-abdomen",
  USG031: "whole-abdomen",
  "USG WHOLE ABDOMEN WITH INGUINAL REGION": "whole-abdomen",
  USG024: "upper-abdomen",
  "UPPER ABDOMEN": "upper-abdomen",
  "USG UPPER ABDOMEN": "upper-abdomen",
  USGLOWER: "lower-abdomen",
  "LOWER ABDOMEN": "lower-abdomen",
  "USG LOWER ABDOMEN": "lower-abdomen",
  "USG LOWER ABDOMEM": "lower-abdomen", // catalog typo
  KUB: "kub",
  "USG KUB": "kub",

  // ── TVS / follicular ───────────────────────────────────────────────────
  TVS: "tvs",
  "USG TVS": "tvs",
  USG010: "tvs",
  "TRANSVAGINAL SONOGRAPHY (TVS)": "tvs",
  FOLLICULAR: "tvs",
  USG005: "tvs",
  "USG FOLLICULAR MONITORING": "tvs",
  "FOLLICULAR MONITORING": "tvs",
  USG009: "tvs",
  SONOSALPINGOGRAPHY: "tvs",

  // ── Obstetrics / fetal ─────────────────────────────────────────────────
  OB: "ob",
  OBSTETRIC: "ob",
  USGA: "ob",
  "USG ANOMALY SCAN": "ob",
  USGFETUS: "ob",
  "USG WHOLE ABDOMEN + FETUS / PREGNANCY": "ob",
  USGFETUSFWB: "ob",
  "USG FOR FWB/FETUS/FETAL WELL BEING/OBS/GROWTH SCAN": "ob",
  FETALDOPPLER: "ob",
  "USG FETAL DOPPLER": "ob",
  UFETALDT: "ob",
  "USG FETAL DOPPLER (TWIN)": "ob",
  // Fetal echo has its OWN Fetal Echo format (owner decision 2026-09-29) —
  // never the adult 2D-Echo format, no longer the generic antenatal scaffold.
  // All fetal DOPPLER rows above stay "ob".
  USGFE: "fetal-echo",
  "USG FETAL ECHO": "fetal-echo",
  "ECHO FETAL": "fetal-echo",
  "FETAL ECHO": "fetal-echo",
  NTSCAN: "ep",
  "USG NT SCAN": "ep",
  USG011: "ob-tiffa-4d",
  "USG ANOMALY SCAN (4D)": "ob-tiffa-4d",
  "USGANOMALYLEVEL II": "ob-tiffa-4d",
  "USG ANOMALY LEVEL II": "ob-tiffa-4d",
  USGANATWIN: "ob-tiffa-twin",
  "USG ANOMALY LEVEL II (TWINS)": "ob-tiffa-twin",

  // ── Adult echocardiography (seeded Echo template) ──────────────────────
  ECHO: "echo",
  "2D ECHO": "echo",
  ECHOCARDIOGRAPHY: "echo",
  CARDIAC: "echo",

  // ── Small parts / other USG ────────────────────────────────────────────
  USG023: "thyroid",
  "USG THYROID": "thyroid",
  USGDOPPLERTHYROID: "thyroid",
  "USG COLOR DOPPLER THYROID": "thyroid",
  USGDOPPLERNECK: "thyroid",
  "USG COLOR DOPPLER NECK": "thyroid",
  SONOMAMMOGRAPHYUL: "breast",
  SONOMAMMOGRAPHYBL: "breast",
  "SONOMAMMOGRAPHY U/L": "breast",
  "SONOMAMMOGRAPHY B/L": "breast",
  USG022: "scrotum",
  "USG SCROTUM/TESTIS": "scrotum",
  USGSCROTUM: "scrotum",
  "USG COLOR DOPPLER INGUINO-SCROTAL": "scrotum",
  USGCHEST: "chest",
  "USG CHEST": "chest",
  USG012: "cranium",
  "USG BRAIN": "cranium",
  USG033: "orbit",
  "USG EYE": "orbit",
  USGFNAC: "swelling",
  "USG GUIDED FNAC": "swelling",
  USGASPIRATION: "swelling",
  "USG GUIDED ASPIRATION": "swelling",
  USG032: "swelling",
  "USG INGUINAL REGION": "swelling",

  // ── Vascular Doppler ───────────────────────────────────────────────────
  USGDOPPLER: "doppler-lower",
  "USG COLOR DOPPLER": "doppler-lower",
  USGDOPPLERLIMBBL: "doppler-lower",
  "USG COLOR DOPPLER LIMB B/L": "doppler-lower",
  USG019: "doppler-lower",
  "USG LIMB DOPPLER B/L": "doppler-lower",
  USG027: "doppler-lower",
  "USG THIGH DOPPLER": "doppler-lower",
  USG028: "doppler-lower",
  "USG PENIS DOPPLER": "doppler-lower",
  USG029: "doppler-lower",
  "USG RENAL DOPPLER B/L": "doppler-lower",
  USG030: "doppler-lower",
  "USG RENAL DOPPLER U/L": "doppler-lower",
  USGDOPPLERLIMBUL: "doppler-upper",
  "USG COLOR DOPPLER LIMB U/L": "doppler-upper",
  USG020: "doppler-upper",
  "USG LIMB DOPPLER U/L": "doppler-upper",

  // ── Non-report / non-USG catalog rows that still appear on USG modality ─
  FIBROSCAN: "unmapped",
  "FIBROSCAN / ELASTOGRAPHY": "unmapped",
  CARD002: "unmapped",
  TMT: "unmapped",
  TRIAL: "unmapped",
};

const STUDY_TYPE_KEYS = new Set<string>([
  "whole-abdomen",
  "upper-abdomen",
  "lower-abdomen",
  "kub",
  "tvs",
  "ob",
  "ep",
  "thyroid",
  "breast",
  "scrotum",
  "trus",
  "cranium",
  "orbit",
  "chest",
  "swelling",
  "carotid",
  "doppler-upper",
  "doppler-lower",
  "echo",
  "fetal-echo",
  "ob-bpp",
  "ob-bpp-twin",
  "ob-tiffa-4d",
  "ob-tiffa-twin",
  "unmapped",
]);

function normalizeProcedureKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function coerceMapEntry(v: unknown): StudyTypeKey | "unmapped" | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t === "unmapped") return "unmapped";
  if (STUDY_TYPE_KEYS.has(t)) return t as StudyTypeKey;
  return null;
}

/** Merge defaults with an optional settings override map. */
export function mergeBillingProcedureMap(
  override?: Record<string, string> | null,
): Record<string, StudyTypeKey | "unmapped"> {
  const out: Record<string, StudyTypeKey | "unmapped"> = { ...DEFAULT_BILLING_PROCEDURE_MAP };
  if (!override) return out;
  for (const [k, v] of Object.entries(override)) {
    if (!k.trim()) continue;
    const coerced = coerceMapEntry(v);
    if (coerced) out[normalizeProcedureKey(k)] = coerced;
  }
  return out;
}

/**
 * Fuzzy match for bill strings that are not exact map keys.
 * Echo / cardiac → "echo" (seeded Echo template). Unknown → unmapped (never WA).
 */
function heuristicStudyType(normalizedLower: string): StudyTypeKey | "unmapped" {
  const t = normalizedLower;

  // Echo family — same studyKey as seeded "Echo — Adult M-Mode" template.
  // Matches /(^|[^a-z])(2d\s*)?echo|echocardi(o|ography)|cardiac/i (non-fetal).
  if (/(^|[^a-z])(2d\s*)?echo\b|\bechocardi(o|ography)\b|\bcardiac\b/.test(t) && !/fetal/.test(t)) {
    return "echo";
  }

  // Fetal echo family — dedicated "fetal-echo" format (owner decision).
  // Runs AFTER the echo-family !/fetal/ guard, BEFORE the bare fetal/ob
  // fallback below. Fetal echo never resolves to adult "echo" or "ob".
  if (/fetal/.test(t) && /(echo|echocardio|cardiac|cardio)/.test(t)) {
    return "fetal-echo";
  }

  // Obstetrics — match the historic Form F routing (growth before BPP;
  // bare "anomaly" stays on the antenatal scaffold; TIFFA/4D/level-II are dedicated).
  if (/twin/.test(t) && (/tiffa|4d/.test(t))) return "ob-tiffa-twin";
  if (/tiffa|targeted|level ?(ii|2)|\b4d\b/.test(t)) return "ob-tiffa-4d";
  if (/nt scan|nuchal|early preg|first trimester|dating|viability|\bep\b/.test(t)) return "ep";
  if (/growth/.test(t)) return "ob";
  if (/\bbpp\b|biophysical/.test(t)) return /twin/.test(t) ? "ob-bpp-twin" : "ob-bpp";
  if (/pregnan|antenatal|obstetric|anomaly|fetal|ob us|obstet|\bob\b/.test(t)) return "ob";

  if (/tvs|transvaginal|follicular|sonosalping|hsg/.test(t)) return "tvs";
  if (/thyroid|neck/.test(t)) return "thyroid";
  if (/breast|sonomamm|mammo/.test(t)) return "breast";
  if (/scrotum|testis|testicular|varicocele|hydrocele/.test(t)) return "scrotum";
  if (/prostate|trus|transrectal/.test(t)) return "trus";
  // Non-USG modalities — never fuzzy-match into a USG format.
  if (/\b(ct|mri|x-?ray|xr|nm|pet)\b/.test(t)) return "unmapped";

  if (/cranium|transfontanelle|infant.*brain|neurosonogram/.test(t)) return "cranium";
  if (/orbit|eye|ocular/.test(t)) return "orbit";
  if (/chest|pleura|thorax|ascitic/.test(t)) return "chest";
  if (/swelling|soft tissue|mass|abscess|lump|fnac|aspirat|inguinal/.test(t)) return "swelling";
  if (/carotid|vertebral/.test(t)) return "carotid";
  if (/doppler/.test(t) && /upper|arm|hand|radial|brachial|av|fistula/.test(t)) return "doppler-upper";
  if (/doppler/.test(t) && /lower|leg|limb|venous|arterial|dvt|varicose|penis|thigh/.test(t)) {
    return "doppler-lower";
  }
  if (/doppler/.test(t)) return "doppler-lower";

  if (/upper abd/.test(t)) return "upper-abdomen";
  if (/lower abd|pelvis|pelvic/.test(t)) return "lower-abdomen";
  if (/kub|kidney|ureter|bladder|calculus|renal/.test(t)) return "kub";
  if (/whole abd|w\.?a\b|general abdomen|screening abdomen/.test(t)) return "whole-abdomen";
  // Bare "abdomen" / paediatric screening — still a whole-abdomen family.
  if (/\babdomen\b|\babd\b/.test(t) && !/echo|cardiac/.test(t)) return "whole-abdomen";

  return "unmapped";
}

function resolveOneProcedureString(
  raw: string,
  map: Record<string, StudyTypeKey | "unmapped">,
): StudyTypeKey | "unmapped" {
  const exact = map[normalizeProcedureKey(raw)];
  if (exact) return exact;
  return heuristicStudyType(raw.toLowerCase());
}

function asBillDeskRef(ref: string | null | BillDeskTestRef): BillDeskTestRef {
  if (ref == null) return {};
  if (typeof ref === "string") return { testName: ref };
  return ref;
}

/** Non-blank candidates in priority order: code, then name / billedProcedure. */
export function billDeskProcedureCandidates(ref: string | null | BillDeskTestRef): string[] {
  const r = asBillDeskRef(ref);
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    if (!t) return;
    if (!out.some((x) => normalizeProcedureKey(x) === normalizeProcedureKey(t))) out.push(t);
  };
  push(r.testCode);
  // Display stand-ins are not procedures — skipping them lets the catalog code
  // below decide, instead of matching (or failing to match) a made-up name.
  if (!isUnnamedStudyPlaceholder(r.testName)) push(r.testName);
  if (!isUnnamedStudyPlaceholder(r.billedProcedure)) push(r.billedProcedure);
  return out;
}

/**
 * Resolve a billed procedure string **or** `{ testCode, testName }` to a study-type key.
 * Code is tried before name so catalog short ids (ECHO, USG W) win even when
 * the display name is blank or generic.
 * @param procedureMap optional settings override (`usg_billing_procedure_map`)
 */
export function resolveBilledStudyType(
  billedProcedure: string | null | BillDeskTestRef,
  procedureMap?: Record<string, string> | null,
): StudyTypeKey | "unmapped" | null {
  const candidates = billDeskProcedureCandidates(billedProcedure);
  if (candidates.length === 0) return null;

  const map = mergeBillingProcedureMap(procedureMap);
  let sawUnmapped = false;
  for (const c of candidates) {
    const hit = resolveOneProcedureString(c, map);
    if (hit === "unmapped") {
      sawUnmapped = true;
      continue;
    }
    return hit;
  }
  return sawUnmapped ? "unmapped" : null;
}

/** Label for banners / study title — name preferred, else code. A display
 * stand-in is not a name, so the catalog code surfaces instead: "Billed: USG W"
 * tells the doctor (and any screenshot) what the bill actually carried. */
export function billDeskProcedureLabel(ref: string | null | BillDeskTestRef): string {
  const r = asBillDeskRef(ref);
  const name = isUnnamedStudyPlaceholder(r.testName) ? "" : (r.testName ?? "").trim();
  const billed = isUnnamedStudyPlaceholder(r.billedProcedure) ? "" : (r.billedProcedure ?? "").trim();
  return name || billed || (r.testCode ?? "").trim();
}

/** Concrete composer study key for a resolved study type + patient sex. */
export function studyKeyForStudyType(
  type: StudyTypeKey,
  sex: "F" | "M" | "" = "",
  child = false,
): string {
  const fem = sex !== "M";
  switch (type) {
    case "whole-abdomen":
      return child ? "wa-child" : fem ? "wa-female" : "wa-male";
    case "lower-abdomen":
      return fem ? "la-female" : "la-male";
    case "upper-abdomen":
      return "ua";
    case "kub":
      return "kub";
    case "tvs":
      return "tvs";
    case "ob":
      return "ob";
    case "ep":
      return "ep";
    case "thyroid":
      return "thyroid";
    case "breast":
      return "breast";
    case "scrotum":
      return "scrotum";
    case "trus":
      return "trus";
    case "cranium":
      return "cranium";
    case "orbit":
      return "orbit";
    case "chest":
      return "chest";
    case "swelling":
      return "swelling";
    case "carotid":
      return "carotid";
    case "doppler-upper":
      return "doppler-upper";
    case "doppler-lower":
      return "doppler-lower";
    case "echo":
      return "echo";
    case "fetal-echo":
      return "fetal-echo";
    case "ob-bpp":
      return "ob-bpp";
    case "ob-bpp-twin":
      return "ob-bpp-twin";
    case "ob-tiffa-4d":
      return "ob-tiffa-4d";
    case "ob-tiffa-twin":
      return "ob-tiffa-twin";
    default:
      return fem ? "wa-female" : "wa-male";
  }
}

export type BilledBootstrapResult =
  | { kind: "none" }
  | { kind: "unmapped"; procedure: string; banner: string }
  | {
      kind: "mapped";
      studyType: StudyTypeKey;
      studyKey: string;
      /** NP template display name when one exists for this study. */
      npTemplateName: string | null;
    };

export function billedUnmappedBanner(procedure: string): string {
  return `Billed: ${procedure} — no matching USG report format. Choose a format manually.`;
}

/**
 * Bootstrap context for study-open / worklist Start.
 * Billing is source #1; null procedure → `{ kind: "none" }` (DICOM/manual fallback).
 */
export function resolveNormalBootstrapFormat(ctx: {
  /** @deprecated prefer testCode + testName — still accepted as the name. */
  billedProcedure?: string | null;
  testCode?: string | null;
  testName?: string | null;
  patientSex?: string | null;
  child?: boolean;
  procedureMap?: Record<string, string> | null;
}): BilledBootstrapResult {
  const ref: BillDeskTestRef = {
    testCode: ctx.testCode,
    testName: ctx.testName ?? ctx.billedProcedure,
    billedProcedure: ctx.billedProcedure,
  };
  const type = resolveBilledStudyType(ref, ctx.procedureMap);
  if (type === null) return { kind: "none" };
  const procedure = billDeskProcedureLabel(ref);
  if (type === "unmapped") {
    return {
      kind: "unmapped",
      procedure,
      banner: procedure
        ? billedUnmappedBanner(procedure)
        : "This study reached the PACS without a test name and the bill carries no catalog code — choose a format.",
    };
  }
  const g = String(ctx.patientSex ?? "").trim().toUpperCase();
  const sex: "F" | "M" | "" = g.startsWith("M") ? "M" : g.startsWith("F") ? "F" : "";
  const studyKey = studyKeyForStudyType(type, sex, !!ctx.child);
  return {
    kind: "mapped",
    studyType: type,
    studyKey,
    npTemplateName: npTemplateNameForStudyKey(studyKey),
  };
}

function npTemplateNameForStudyKey(studyKey: string): string | null {
  switch (studyKey) {
    case "wa-female":
      return "NP Whole Abdomen — Female";
    case "wa-male":
      return "NP Whole Abdomen — Male";
    case "wa-child":
      return "NP Whole Abdomen — Child";
    case "ua":
      return "NP Upper Abdomen";
    case "kub":
      return "NP KUB";
    case "tvs":
      return "NP TVS";
    case "la-female":
      return "NP Lower Abdomen — Female";
    case "la-male":
      return "NP Lower Abdomen — Male";
    case "echo":
      return "Echo — Adult M-Mode";
    case "fetal-echo":
      return "USG Fetal Echocardiography";
    default:
      return null;
  }
}

/** Human label for worklist study-type badge. */
export function studyTypeBadgeLabel(type: StudyTypeKey | "unmapped" | null): string | null {
  if (!type) return null;
  if (type === "unmapped") return "Unmapped";
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

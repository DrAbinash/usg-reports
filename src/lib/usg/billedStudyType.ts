/**
 * billedStudyType.ts — billing-desk procedure → USG study-type resolution.
 *
 * PRIMARY source of truth when a bill-desk row exists. Returns:
 *   • StudyTypeKey — known USG report format family
 *   • "unmapped"   — billed procedure has no USG format (e.g. ECHO) → block auto-bootstrap
 *   • null         — no billed procedure string → fall back to DICOM / manual as today
 *
 * Override the default table via settings key `usg_billing_procedure_map`
 * (JSON object of uppercase procedure name → StudyTypeKey | "unmapped").
 */

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
  | "ob-bpp"
  | "ob-bpp-twin"
  | "ob-tiffa-4d"
  | "ob-tiffa-twin";

/** Settings key — JSON map stored on HospitalSettings.usgBillingProcedureMapJson. */
export const USG_BILLING_PROCEDURE_MAP_KEY = "usg_billing_procedure_map";

/** Default procedure → study-type table (uppercase keys). */
export const DEFAULT_BILLING_PROCEDURE_MAP: Record<string, StudyTypeKey | "unmapped"> = {
  "USG WHOLE ABDOMEN": "whole-abdomen",
  "WHOLE ABDOMEN": "whole-abdomen",
  "UPPER ABDOMEN": "upper-abdomen",
  "USG UPPER ABDOMEN": "upper-abdomen",
  KUB: "kub",
  "USG KUB": "kub",
  TVS: "tvs",
  "LOWER ABDOMEN": "lower-abdomen",
  "USG LOWER ABDOMEN": "lower-abdomen",
  OB: "ob",
  OBSTETRIC: "ob",
  ECHO: "unmapped",
  "2D ECHO": "unmapped",
  ECHOCARDIOGRAPHY: "unmapped",
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
 * ECHO family always → unmapped. Unknown → unmapped (never whole-abdomen).
 */
function heuristicStudyType(normalizedLower: string): StudyTypeKey | "unmapped" {
  const t = normalizedLower;

  // Cardiology — no USG letterhead format in this studio.
  if (/\b2\s*d\s*echo\b|\bechocardiogra|\becho\b|\bcardiac\b/.test(t) && !/fetal/.test(t)) {
    return "unmapped";
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

/**
 * Resolve a billed procedure string to a study-type key.
 * @param billedProcedure bill-desk test name, or null when no billed row
 * @param procedureMap optional settings override (`usg_billing_procedure_map`)
 */
export function resolveBilledStudyType(
  billedProcedure: string | null,
  procedureMap?: Record<string, string> | null,
): StudyTypeKey | "unmapped" | null {
  if (billedProcedure == null) return null;
  const trimmed = billedProcedure.trim();
  if (!trimmed) return null;

  const map = mergeBillingProcedureMap(procedureMap);
  const exact = map[normalizeProcedureKey(trimmed)];
  if (exact) return exact;

  return heuristicStudyType(trimmed.toLowerCase());
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
  billedProcedure: string | null;
  patientSex?: string | null;
  child?: boolean;
  procedureMap?: Record<string, string> | null;
}): BilledBootstrapResult {
  const type = resolveBilledStudyType(ctx.billedProcedure, ctx.procedureMap);
  if (type === null) return { kind: "none" };
  const procedure = (ctx.billedProcedure ?? "").trim();
  if (type === "unmapped") {
    return {
      kind: "unmapped",
      procedure,
      banner: billedUnmappedBanner(procedure || "unknown procedure"),
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

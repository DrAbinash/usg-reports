/**
 * orderStudy.ts — bill-desk test name/code → the studio's own study key.
 *
 * Delegates study-type decisions to `resolveBilledStudyType` (the only place
 * billing may choose a format). Unmapped bills return null so callers can
 * block auto-bootstrap instead of silently opening Whole Abdomen.
 */
import { USG_STUDIES } from "./studies";
import {
  resolveBilledStudyType,
  resolveNormalBootstrapFormat,
  studyKeyForStudyType,
  type BillDeskTestRef,
  type StudyTypeKey,
} from "./billedStudyType";

export const STUDY_KEYS = USG_STUDIES.map((s) => s.key) as string[];

/** Obstetric families — these carry the statutory PC-PNDT Form F duty.
 *  v6.13: includes combined studies (wa-ob, tvs-ob) and also matches
 *  any key starting with "ob-" (for future study types like ob-anomaly).
 *  "fetal-echo" is scanned on the pregnant patient, so it keeps the Form F
 *  duty it had when billed USGFE resolved to "ob". */
export const OB_STUDY_KEYS = new Set(["ob", "ep", "wa-ob", "tvs-ob", "fetal-echo"]);

export function isObStudyKey(key: string): boolean {
  return OB_STUDY_KEYS.has(key) || key.startsWith("ob-");
}

/**
 * Guess the studio study for a bill-desk test name and/or catalog code.
 * @returns concrete study key, or null when there is no billed string / unmapped
 *   (unknown / non-USG) — callers must NOT default to whole-abdomen.
 */
export function guessStudyKey(
  testNameOrRef: string | BillDeskTestRef,
  sex: "F" | "M" | "" = "",
  child = false,
  procedureMap?: Record<string, string> | null,
): string | null {
  const ref: BillDeskTestRef =
    typeof testNameOrRef === "string" ? { testName: testNameOrRef } : testNameOrRef;
  const boot = resolveNormalBootstrapFormat({
    testCode: ref.testCode,
    testName: ref.testName ?? ref.billedProcedure ?? null,
    billedProcedure: ref.billedProcedure ?? ref.testName ?? null,
    patientSex: sex,
    child,
    procedureMap,
  });
  if (boot.kind === "mapped") return boot.studyKey;
  return null;
}

/** Re-export for call sites that only need the type-level decision. */
export { resolveBilledStudyType, resolveNormalBootstrapFormat, studyKeyForStudyType };
export type { StudyTypeKey, BillDeskTestRef };

/** The sex a report should open with, from the bill's sex string. */
export function orderSex(gender: string | null | undefined, child = false): "F" | "M" | "CHILD" {
  if (child) return "CHILD";
  const g = String(gender ?? "").trim().toUpperCase();
  if (g.startsWith("M")) return "M";
  return "F";
}

/** Whether a billed test name/code suggests a paediatric patient. */
export function testSuggestsChild(testNameOrCode: string): boolean {
  const t = String(testNameOrCode ?? "").toLowerCase();
  return /child|paed|ped|infant|neonat|transfontanelle|baby/.test(t);
}

/** Key-sorted stringify, so object ordering alone never looks like an edit. */
function canonicalJson(raw: string): string | null {
  try {
    return stable(JSON.parse(raw));
  } catch {
    return null;
  }
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, val]) => `${JSON.stringify(k)}:${stable(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(v);
}

/**
 * True when a draft still holds exactly what the format generator produced —
 * nothing of the doctor's own.
 *
 * This is the gate that lets the bill desk decide the format AFTER a draft
 * already exists. A study that arrived in PACS first opens as a draft while its
 * billed name is still the "USG Study" stand-in (or nothing at all), and CARE's
 * real procedure only arrives on a later sync; without re-resolution the report
 * keeps whatever format the empty moment guessed. Re-resolving is safe only
 * while the draft is untouched, so this compares the stored state against a
 * freshly generated one for the draft's own study key: any organ tap, note,
 * measurement or added image makes it differ.
 *
 * Deliberately strict in the direction that costs nothing: a false negative
 * skips one automatic adoption and the doctor picks the format as before, while
 * a false positive would overwrite clinical text. An empty canvas (no study
 * key) has nothing to lose, so it counts as pristine.
 */
export function isPristineDraft(opts: {
  finalizedAt?: Date | string | null;
  studyKey: string | null | undefined;
  stateJson: string | null | undefined;
  /** `JSON.stringify(normaliseState({}, studyKey))` for that same study key. */
  defaultStateJson: string;
}): boolean {
  if (opts.finalizedAt) return false;
  const key = (opts.studyKey ?? "").trim();
  if (!key) return true;
  const stored = canonicalJson((opts.stateJson ?? "").trim());
  if (stored === null) return false;
  return stored === canonicalJson(opts.defaultStateJson);
}

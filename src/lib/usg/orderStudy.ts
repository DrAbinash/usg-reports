/**
 * orderStudy.ts — bill-desk test name → the studio's own study key.
 *
 * Delegates study-type decisions to `resolveBilledStudyType` (the only place
 * billing may choose a format). Unknown / ECHO bills return null so callers
 * can block auto-bootstrap instead of silently opening Whole Abdomen.
 */
import { USG_STUDIES } from "./studies";
import {
  resolveBilledStudyType,
  resolveNormalBootstrapFormat,
  studyKeyForStudyType,
  type StudyTypeKey,
} from "./billedStudyType";

export const STUDY_KEYS = USG_STUDIES.map((s) => s.key) as string[];

/** Obstetric families — these carry the statutory PC-PNDT Form F duty.
 *  v6.13: includes combined studies (wa-ob, tvs-ob) and also matches
 *  any key starting with "ob-" (for future study types like ob-anomaly). */
export const OB_STUDY_KEYS = new Set(["ob", "ep", "wa-ob", "tvs-ob"]);

export function isObStudyKey(key: string): boolean {
  return OB_STUDY_KEYS.has(key) || key.startsWith("ob-");
}

/**
 * Guess the studio study for a bill-desk test name.
 * @returns concrete study key, or null when there is no billed string / unmapped
 *   (ECHO, cardiology, unknown) — callers must NOT default to whole-abdomen.
 */
export function guessStudyKey(
  testName: string,
  sex: "F" | "M" | "" = "",
  child = false,
  procedureMap?: Record<string, string> | null,
): string | null {
  const boot = resolveNormalBootstrapFormat({
    billedProcedure: testName?.trim() ? testName : null,
    patientSex: sex,
    child,
    procedureMap,
  });
  if (boot.kind === "mapped") return boot.studyKey;
  return null;
}

/** Re-export for call sites that only need the type-level decision. */
export { resolveBilledStudyType, resolveNormalBootstrapFormat, studyKeyForStudyType };
export type { StudyTypeKey };

/** The sex a report should open with, from the bill's sex string. */
export function orderSex(gender: string | null | undefined, child = false): "F" | "M" | "CHILD" {
  if (child) return "CHILD";
  const g = String(gender ?? "").trim().toUpperCase();
  if (g.startsWith("M")) return "M";
  return "F";
}

/** Whether a billed test name suggests a paediatric patient. */
export function testSuggestsChild(testName: string): boolean {
  const t = String(testName ?? "").toLowerCase();
  return /child|paed|ped|infant|neonat|transfontanelle|baby/.test(t);
}

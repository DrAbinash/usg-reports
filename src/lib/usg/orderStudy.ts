/**
 * orderStudy.ts — bill-desk test name → the studio's own study key.
 *
 * The ERP worklist hands us the bill's test name ("USG Whole Abdomen",
 * "USG Pregnancy 2nd Trimester", "TVS", …). The doctor should never have to
 * re-pick the study: this pure mapper guesses the closest of the studio's 22
 * studies, sex-aware, obstetrics-first (they carry the PC-PNDT Form F duty).
 *
 * Ported from the MRI studio's guessRegion() USG branch, translated to this
 * app's study keys, and deliberately conservative: unknown names fall back
 * to Whole Abdomen of the billed sex (the clinic's default screening).
 */
import { USG_STUDIES } from "./studies";

export const STUDY_KEYS = USG_STUDIES.map((s) => s.key) as string[];

/** Obstetric families — these carry the statutory PC-PNDT Form F duty. */
export const OB_STUDY_KEYS = new Set(["ob", "ep"]);

export function isObStudyKey(key: string): boolean {
  return OB_STUDY_KEYS.has(key);
}

function wholeAbdomen(sex: "F" | "M" | ""): string {
  return sex === "M" ? "wa-male" : "wa-female";
}

function lowerAbdomen(sex: "F" | "M" | ""): string {
  return sex === "M" ? "la-male" : "la-female";
}

/**
 * Guess the studio study for a bill-desk test name.
 * @param testName bill's test name (e.g. "USG Lower Abdomen")
 * @param sex      patient sex from the bill ("F" | "M" | "" unknown)
 * @param child    true when the bill names a child/paediatric patient
 */
export function guessStudyKey(testName: string, sex: "F" | "M" | "" = "", child = false): string {
  const t = String(testName ?? "").toLowerCase();

  // Obstetrics first — the Form F duty and the most safety-critical routing.
  if (/tvs|transvaginal|follicular|hsg/.test(t)) return "tvs";
  if (/early preg|first trimester|dating|viability|\bep\b/.test(t)) return "ep";
  if (/pregnan|antenatal|obstetric|anomaly|growth|bpp|fetal|ob us|obstet/.test(t)) return "ob";

  // Sex-aware default screening when the bill is just "USG abdomen".
  const sexOr = child ? "CHILD" : sex;

  if (child && /abd|abdomen|screening/.test(t)) return "wa-child";
  if (/whole abd|w\.?a\b|general abdomen|screening abdomen/.test(t)) return wholeAbdomen(sex);
  if (/upper abd/.test(t)) return "ua";
  if (/lower abd|pelvis|pelvic/.test(t)) return lowerAbdomen(sex);

  if (/kub|kidney|ureter|bladder|calculus|renal/.test(t)) return "kub";
  if (/thyroid|neck/.test(t)) return "thyroid";
  if (/breast|sonomamm|mammo/.test(t)) return "breast";
  if (/scrotum|testis|testicular|varicocele|hydrocele|penis/.test(t)) return "scrotum";
  if (/prostate|trus|transrectal/.test(t)) return "trus";
  if (/cranium|transfontanelle|infant.*brain|neurosonogram/.test(t)) return "cranium";
  if (/orbit|eye|ocular/.test(t)) return "orbit";
  if (/chest|pleura|thorax/.test(t)) return "chest";
  if (/swelling|soft tissue|mass|abscess|lump/.test(t)) return "swelling";

  // Doppler family (obstetric doppler already matched "ob" above).
  if (/carotid|vertebral/.test(t)) return "carotid";
  if (/doppler/.test(t) && /upper|arm|hand|radial|brachial|av|fistula/.test(t)) return "doppler-upper";
  if (/doppler/.test(t) && /lower|leg|limb|venous|arterial|dvt|varicose/.test(t)) return "doppler-lower";
  if (/doppler/.test(t)) return "doppler-lower";
  if (/echo|echocardio|cardiac/.test(t)) return "echo";

  // Sexed abdomen fallback for anything else abdominal-sounding.
  if (/abd|abdomen|sonography|ultrasound|usg|^us\b/.test(t)) {
    return child ? "wa-child" : wholeAbdomen(sex);
  }
  return child ? "wa-child" : wholeAbdomen(sex);
}

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

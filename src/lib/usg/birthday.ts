/**
 * USG Studio — "Sonologist's Day" birthday greeting (v6.1).
 *
 * A small delight: once a year, on the sonologist's birthday, the studio
 * opens with a full-screen card before the first probe warms up. The date
 * lives in Settings (usgDoctorBirthday, "MM-DD") so it works for any
 * doctor, any clinic — defaults to 09-01 for Dr. Sugandha.
 *
 * Pure functions only — clock access is injected so tests are deterministic.
 */

/** Accept the ways a human might type a birthday; return canonical "MM-DD".
 *  Returns "" for anything unparseable (the greeting then stays off). */
export function normalizeBirthday(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  // Accept MM-DD, MM/DD, MM.DD, M-D (separators: - / . or whitespace).
  const m = t.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
  if (!m) return "";
  const mo = Number(m[1]);
  const day = Number(m[2]);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return "";
  // Reject impossible month/day pairs (Feb 30 etc.) — the card must never
  // fire on a date that cannot exist. 2000 is a leap year so Feb 29 passes.
  const probe = new Date(2000, mo - 1, day);
  if (probe.getMonth() !== mo - 1 || probe.getDate() !== day) return "";
  return `${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Does the LOCAL calendar date (month + day) match the configured birthday?
 *  Empty/invalid config never matches. 02-29 matches only real Feb 29s —
 *  a leap-day birthday simply rests on non-leap years. */
export function isBirthdayToday(birthday: string, now: Date = new Date()): boolean {
  const b = normalizeBirthday(birthday);
  if (!b) return false;
  const [bm, bd] = b.split("-").map(Number);
  return now.getMonth() + 1 === bm && now.getDate() === bd;
}

/** Pretty local label for the card, e.g. "1 September". */
export function birthdayLabel(birthday: string, now: Date = new Date()): string {
  const b = normalizeBirthday(birthday);
  if (!b) return "";
  const [bm, bd] = b.split("-").map(Number);
  // Render with the CURRENT year so the phrasing is right even in tests.
  const d = new Date(now.getFullYear(), bm - 1, bd);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

/** The name on the card: the saved sonologist name, trimmed and honorific-
 *  safe; falls back to a warm generic so the card is never headless. */
export function greetingName(raw: string): string {
  const t = raw.trim();
  if (!t) return "Doctor";
  // "Dr. Sugandha Priyadarshini" greets as "Dr. Sugandha Priyadarshini";
  // a plain "Sugandha" becomes "Dr. Sugandha" — the studio is formal-warm.
  return /^(dr\.?|doctor)\b/i.test(t) ? t : `Dr. ${t}`;
}

/** localStorage key: one dismissal per calendar year, self-expiring. */
export function dismissalKey(year: number): string {
  return `usg-birthday-greeted-${year}`;
}

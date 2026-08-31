/**
 * USG Studio — LMP calculator.
 *
 * Enter the last menstrual period; gestational age (weeks + days) and the
 * expected date of delivery follow automatically — Naegele's rule (LMP + 280
 * days) — and can be pushed straight into the biometry tokens ({gaw}/{gad}/
 * {edd}) of the antenatal formats. The doctor's scan-based GA always wins if
 * she types her own numbers afterwards: LMP only pre-fills the slots.
 */

const DAY_MS = 86_400_000;

/** Gestational age at `on` (default today) from an LMP date. */
export function gaFromLmp(lmp: Date, on: Date = new Date()): { weeks: number; days: number } {
  const days = Math.max(0, Math.floor((on.getTime() - lmp.getTime()) / DAY_MS));
  return { weeks: Math.floor(days / 7), days: days % 7 };
}

/** Expected date of delivery — Naegele's rule: LMP + 280 days. */
export function eddFromLmp(lmp: Date): Date {
  return new Date(lmp.getTime() + 280 * DAY_MS);
}

/** "07-Jan-2027" — unambiguous on every printed report. */
export function formatEdd(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

/** Parse a yyyy-mm-dd input value (the <input type="date"> contract). */
export function parseLmpInput(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Reject roll-over dates like 2026-02-30 (JS silently maps them to Mar 2).
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

/**
 * Everything the antenatal formats need, from one LMP value:
 *   GA  — "28 weeks 5 days" style components for {gaw}/{gad}
 *   EDD — formatted for {edd}
 */
export function lmpSummary(lmp: Date, on: Date = new Date()): {
  weeks: number;
  days: number;
  edd: string;
  eddDate: Date;
} {
  const { weeks, days } = gaFromLmp(lmp, on);
  const eddDate = eddFromLmp(lmp);
  return { weeks, days, edd: formatEdd(eddDate), eddDate };
}

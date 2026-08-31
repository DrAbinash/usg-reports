/**
 * USG Studio — scan-date helpers.
 *
 * The scan date is editable so the doctor can back-date a report typed up
 * after the fact; the <input type="date"> contract is "yyyy-mm-dd". Dates are
 * stored at local noon so no timezone boundary can shift them a day.
 */

/** "yyyy-mm-dd" → Date (local noon); anything else → null. */
export function parseScanDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date | null | undefined → "yyyy-mm-dd" for the date input; null → today. */
export function toScanDateInput(d: Date | null | undefined): string {
  const date = d ?? new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

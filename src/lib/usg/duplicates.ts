/**
 * Same-patient, same-day duplicate detection (Phase 5).
 *
 * The studio has no barrier to scanning one patient twice in a day: the worklist
 * keys a draft off a CARE bill (`/worklist/[id]/start` is idempotent per order),
 * so a second bill for the same name on the same morning — or a "New Report"
 * pressed a second time — opens a second draft, gets its own register number,
 * and the patient's record is split across two signed documents nobody can join
 * afterwards. The history panel then shows two priors and the follow-up diff
 * compares against the wrong one.
 *
 * This is deliberately a WARNING, not a gate: two scans on one day are sometimes
 * legitimate (a repeat after a drain, a KUB added to a whole abdomen), and only
 * the doctor knows which case he is in. What he cannot know without being told
 * is that the other report exists — so the composer says so, names it, and hands
 * him a button that opens it.
 *
 * Server-side module: it borrows the name rule from careSync, which imports the
 * database client. Never import this from a component.
 */
import { samePatientName } from "./careSync";

/** The clinic's IST day as a half-open [start, end) window over UTC instants. */
export function istDayWindow(ymd: string): [Date, Date] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - (5 * 60 + 30) * 60 * 1000;
  return [new Date(start), new Date(start + 24 * 60 * 60 * 1000)];
}

export type DuplicateCandidate = {
  id: string;
  patientName: string;
  studyKey: string;
  status: string;
  serialNo: number | null;
  scanDate: string | null;
  createdAt: string;
};

/**
 * Reports that are the same patient, the same study and the same scanning day as
 * the draft being written — excluding the draft itself.
 *
 * `day` is compared against the scan date when there is one and the creation
 * instant when the doctor never set it, because an undated draft is today's work
 * until he says otherwise.
 */
export function sameDaySiblings(
  rows: DuplicateCandidate[],
  opts: { name: string; studyKey: string; day: string; excludeId?: string | null },
): DuplicateCandidate[] {
  const window = istDayWindow(opts.day);
  if (!window) return [];
  const [from, to] = window;
  const within = (iso: string | null): boolean => {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ms) && ms >= from.getTime() && ms < to.getTime();
  };
  return rows
    .filter((r) => r.id !== opts.excludeId)
    .filter((r) => within(r.scanDate ?? r.createdAt))
    .filter((r) => samePatientName(r.patientName, opts.name))
    .filter((r) => (r.studyKey ?? "").trim() === opts.studyKey.trim())
    .sort((a, b) => Date.parse(b.scanDate ?? b.createdAt) - Date.parse(a.scanDate ?? a.createdAt));
}

/** The sentence on the banner. Names the other report enough to recognise it. */
export function duplicateLabel(row: DuplicateCandidate): string {
  const signed = row.status === "FINALIZED";
  const when = row.scanDate
    ? new Date(row.scanDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : new Date(row.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return signed
    ? `register no. ${row.serialNo != null ? String(row.serialNo).padStart(4, "0") : "—"}, ${when}`
    : `draft, ${when}`;
}

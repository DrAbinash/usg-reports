/**
 * CARE ↔ USG worklist sync engine (v6.1 identity fix).
 *
 * Why this file exists: the v6 sync silently dropped every CARE ultrasound
 * row whose accessionNumber was blank — which, on this ERP, is most of them
 * (the bill desk keys rows by worklistId and attaches the StudyInstanceUID,
 * leaving accessionNumber "" until/unless a radiology accession exists).
 * Images could never link either, because Orthanc matching was
 * accession-only.
 *
 * Identity model (patient-safety first — exact matches only, never names):
 *
 *   CARE order identity      1. careWorklistId (deterministic oldest-first)
 *                            2. accessionNumber — legacy bridge, non-blank only
 *   Imaging study identity   1. StudyInstanceUID — exact
 *                            2. AccessionNumber — exact, unambiguous single hit
 *                            never: patient-name matching, "first match",
 *                            synthesized accession numbers.
 *
 * A row imports when patientName exists AND at least one stable identifier
 * (studyInstanceUid | accessionNumber | careWorklistId) is present. A row
 * with no Orthanc study yet simply shows as "Awaiting images" — it never
 * disappears.
 *
 * What a bill is for, and what a scan is for: this engine writes rows only for
 * what CARE's bill desk has billed. A study that arrived in the PACS with no
 * bill behind it is not turned into a pseudo-order — it stays a scan, read live
 * from DICOMweb by patient details and the referring doctor's name
 * (UsgPacsQueue → /api/usg/reports/pacs-draft). Claiming the one thing it does
 * not have (a bill) is what made 1,218 of this clinic's 2,301 worklist rows
 * noise.
 *
 * The DB-facing functions take the Prisma client from @/lib/db (the tests
 * run them against the real scratch database), and every decision path is
 * counted: the sync response reports the numbers, nothing is silent.
 */
import { db } from "@/lib/db";
import {
  careTestCode,
  careTestName,
  isUltrasoundModality,
  splitAgeSex,
  type CareWorklistItem,
} from "./careClient";
import type { OrthancStudy, OrthancUsStudyRow } from "./orthancClient";
import { addCalendarDaysYmd, clinicTodayIST } from "./dates";

// ── pure row normalisation ──────────────────────────────────────────────────

export type NormalizedCareRow = {
  name: string;
  wlId: string | null;
  acc: string | null;
  uid: string | null;
  bill: string | null; // v6.14: billNumber as fallback identity
  erpStatus: string | null; // v6.14.1: ERP-side worklist status (REPORT_FINAL / DELIVERED / ...)
};

const clean = (v: string | null | undefined): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

/** Trim the ERP payload into the stable identities + the name. */
export function normalizeCareRow(w: CareWorklistItem): NormalizedCareRow {
  return {
    name: (w.patientName ?? "").trim(),
    wlId: clean(w.worklistId),
    acc: clean(w.accessionNumber),
    uid: clean(w.studyInstanceUid),
    bill: clean(w.billNumber), // v6.14
    erpStatus: clean(w.status), // v6.14.1
  };
}

/** v6.14.1 — ERP says it has already finalized this row.
 *  Older ERP builds (or ?status=pending feeds) never send `status`,
 *  so undefined → false (treat as still pending). Only the literal
 *  REPORT_FINAL / DELIVERED values count as "ERP already done". */
export function isErpFinalized(erpStatus: string | null | undefined): boolean {
  const s = typeof erpStatus === "string" ? erpStatus.trim().toUpperCase() : "";
  return s === "REPORT_FINAL" || s === "DELIVERED";
}

export type ImportDecision =
  | { kind: "skip"; reason: "noName" | "missingIdentity" }
  | { kind: "import" };

/**
 * Import gate: a patient name plus at least one stable identifier.
 * Blank-accession rows with a worklistId or StudyInstanceUID are the ERP's
 * normal output and MUST import; rows with no identity at all are skipped
 * with a counted reason (there is nothing safe to dedup them by).
 *
 * v6.14: also accept billNumber as a fallback identity — some ERPs don't
 * send accession/worklistId but always send a bill number.
 */
export function decideImport(n: NormalizedCareRow): ImportDecision {
  if (!n.name) return { kind: "skip", reason: "noName" };
  // v6.14: accept billNumber as a fallback identity
  if (!n.wlId && !n.acc && !n.uid && !n.bill) return { kind: "skip", reason: "missingIdentity" };
  return { kind: "import" };
}

export type CarePullRequest = { full: boolean; since: string | null };

/**
 * How far back an ordinary sync re-reads CARE's worklist, on every cycle.
 *
 * This replaced a watermark, and deliberately. A watermark is a promise that
 * CARE has served everything up to a given instant, and it can only be honoured
 * by refusing to move when any row fails to land — which is exactly the failure
 * mode it then feeds. Measured on this clinic 2026-10-30: `P1008` socket
 * timeouts rejected the tail of a 448-row pull, the cursor held, the hold path
 * also refused to stamp the repair pull's own clock
 * (`lastDeepPullAt … && action === "advance"`), so every later cycle re-ran the
 * heaviest possible pull and failed in the same place. The watermark sat at
 * `2026-10-11T19:44:32Z` for 18.5 days with 19 orders refusing to land, and
 * `cursorHoldCount` read `1` — the counter that was supposed to give up after
 * ten holds could never climb, because the same outage kept resetting it.
 *
 * A window makes no promise to keep. Each cycle asks for the last few days and
 * upserts what comes back, so a row that fails for any reason — a timeout, a
 * restart, a bill linked two days after the scan — is served again on the next
 * cycle. Nothing can hide behind a cursor because there is no cursor. At roughly
 * 150 studies a day the extra read costs almost nothing; the failure mode it
 * removes is what this clinic just spent 18 days in.
 */
export const SYNC_LOOKBACK_DAYS = 3;

/**
 * Decide what this cycle reads. A Studio holding no orders, or an explicit
 * `?full=1`, pages CARE's whole backlog once — a few days cannot rebuild
 * history. Counting orders rather than patients is deliberate: a `UsgPatient`
 * row only appears once a report is saved, so counting patients would keep a
 * freshly pulled Studio backfilling forever.
 */
export function planWorklistPull(opts: {
  fullRequested: boolean;
  localOrders: number;
  nowMs: number;
  lookbackDays?: number;
}): CarePullRequest {
  if (opts.fullRequested || opts.localOrders === 0) return { full: true, since: null };
  const days = opts.lookbackDays ?? SYNC_LOOKBACK_DAYS;
  return { full: false, since: new Date(opts.nowMs - days * 24 * 60 * 60 * 1000).toISOString() };
}

/**
 * Days of the PACS archive one cycle looks at, for BOTH passes: linking images
 * to existing orders and importing un-billed ones.
 *
 * The link pass used to sweep 14 days while the import rule underneath it only
 * keeps a fallback row for 3 — so most of the ~1,079 studies read on every
 * two-minute cycle were ones the very next step refused to act on, and the
 * sweep was one of the things timing out (`listRecentUltrasoundStudies: Orthanc
 * DICOMweb timed out`). One number, matching the rule that actually uses it.
 */
export const ORTHANC_SWEEP_DAYS = 7;

// ── pure Orthanc matching ───────────────────────────────────────────────────

export type OrthancMatch =
  | { kind: "studyUid"; study: OrthancStudy }
  | { kind: "accession"; study: OrthancStudy }
  | { kind: "ambiguous" }
  | { kind: "none" };

/**
 * Match ONE order against the Orthanc study set — exact identifiers only.
 *
 * Priority: StudyInstanceUID first (the DICOM identity, already preferred
 * when CARE supplies it), then a single-hit AccessionNumber. Multiple
 * accession hits are AMBIGUOUS and never resolved by "first match";
 * patient names are never consulted.
 */
export function matchOrthancStudy(
  order: { studyInstanceUid: string | null; accessionNumber: string | null },
  byUid: Map<string, OrthancStudy[]>,
  byAcc: Map<string, OrthancStudy[]>,
): OrthancMatch {
  if (order.studyInstanceUid) {
    const hits = byUid.get(order.studyInstanceUid);
    if (hits && hits.length >= 1) return { kind: "studyUid", study: hits[0] };
  }
  if (order.accessionNumber) {
    const hits = byAcc.get(order.accessionNumber);
    if (hits && hits.length === 1) return { kind: "accession", study: hits[0] };
    if (hits && hits.length > 1) return { kind: "ambiguous" };
  }
  return { kind: "none" };
}

/** Index Orthanc studies by their exact MainDicomTags identities. */
export function indexOrthancStudies(studies: OrthancStudy[]): {
  byUid: Map<string, OrthancStudy[]>;
  byAcc: Map<string, OrthancStudy[]>;
} {
  const byUid = new Map<string, OrthancStudy[]>();
  const byAcc = new Map<string, OrthancStudy[]>();
  for (const st of studies) {
    const uid = clean(st.MainDicomTags?.StudyInstanceUID);
    if (uid) mapPush(byUid, uid, st);
    const acc = clean(st.MainDicomTags?.AccessionNumber);
    if (acc) mapPush(byAcc, acc, st);
  }
  return { byUid, byAcc };
}

function mapPush(m: Map<string, OrthancStudy[]>, k: string, v: OrthancStudy) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

// ── sync statistics (observability — counts only, never secrets) ────────────

export type SyncStats = {
  careRowsReceived: number;
  ultrasoundRowsReceived: number;
  imported: number;
  updatedExisting: number;
  alreadyReported: number;
  /** v6.14.1 — ERP says REPORT_FINAL/DELIVERED but the studio hasn't
   *  finalized locally. Counted so the operator can see how many cases
   *  the studio missed (e.g. someone finalized directly in ERP). The
   *  row is left untouched — the doctor should reconcile in the UI. */
  erpFinalizedNotLocal: number;
  skippedNoName: number;
  skippedMissingIdentity: number;
  errors: number;
  /** Safe per-row diagnostics — worklistId + reason, never patient data. */
  skippedReasons: string[];
};

export const emptySyncStats = (): SyncStats => ({
  careRowsReceived: 0,
  ultrasoundRowsReceived: 0,
  imported: 0,
  updatedExisting: 0,
  alreadyReported: 0,
  erpFinalizedNotLocal: 0,
  skippedNoName: 0,
  skippedMissingIdentity: 0,
  errors: 0,
  skippedReasons: [],
});

export type AttachStats = {
  orthancStudies: number;
  matchedByStudyUid: number;
  matchedByAccession: number;
  ambiguousMatches: number;
  /** Orders with NO Study UID at all — the ones genuinely waiting on images. */
  awaitingImages: number;
  /**
   * Orders that already carry a Study UID which this cycle's sweep did not
   * contain. They are NOT waiting: the images exist, the sweep window simply
   * did not reach them. Counted separately because mixing the two reported
   * "1807 awaiting images" on a NAS holding ~150 studies a day, which read as a
   * PACS outage and was a window.
   */
  uidOutsideSweep: number;
  unmatchedOrthanc: number;
};

export const emptyAttachStats = (): AttachStats => ({
  orthancStudies: 0,
  matchedByStudyUid: 0,
  matchedByAccession: 0,
  ambiguousMatches: 0,
  awaitingImages: 0,
  uidOutsideSweep: 0,
  unmatchedOrthanc: 0,
});

/** Stats for the outage safety net — scans pushed into Orthanc that CARE has
 *  not served yet. */
export type OrphanImportStats = {
  orthancUsStudies: number;
  importedFromOrthanc: number;
  alreadyPresent: number;
  skippedNoName: number;
  skippedNoUid: number;
  /** A bill-desk order for this patient on this day already represents them. */
  skippedBilledRowExists: number;
  /** Older than {@link ORPHAN_MAX_AGE_DAYS} — archive history, not today's list. */
  skippedTooOld: number;
  errors: number;
  /** Safe per-row diagnostics — study UID tail + reason, never patient data. */
  skippedReasons: string[];
};

export const emptyOrphanImportStats = (): OrphanImportStats => ({
  orthancUsStudies: 0,
  importedFromOrthanc: 0,
  alreadyPresent: 0,
  skippedNoName: 0,
  skippedNoUid: 0,
  skippedBilledRowExists: 0,
  skippedTooOld: 0,
  errors: 0,
  skippedReasons: [],
});

/**
 * How far back the outage safety net reaches. Not a feed — a stopgap: while
 * CARE's rows are not arriving, a scanned patient must still be reportable.
 * Measured 2026-10-06 with the sync cursor stuck: one 14-day sweep wrote ~1,400
 * of these onto a list that carries about 100 real patients a day, and the
 * bill-desk rows vanished underneath them.
 */
export const ORPHAN_MAX_AGE_DAYS = 3;

/** The clinic's calendar day, read as IST wall time (the scanner's own clock). */
export function istDayOfDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const ms = d.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Sorted lowercase name tokens. CARE writes "First Last" and the scanner writes
 * "LAST^FIRST", so order is discarded before anything is compared.
 */
export function nameTokens(name: string | null | undefined): string[] {
  return (name ?? "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort();
}

/**
 * "Same patient, same scanning day" key — sorted name tokens, so CARE's
 * "First Last" and the DICOM "LAST^FIRST" agree. Order matters nowhere here;
 * only that both sides of one patient produce one key.
 */
export function nameDayKey(name: string | null | undefined, ymd: string | null | undefined): string | null {
  const d = (ymd ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const tokens = nameTokens(name);
  if (!tokens.length) return null;
  return `${tokens.join(" ")}|${d}`;
}

/**
 * A referring doctor's name, reduced to what survives the two sources disagreeing
 * about style: "Dr. R. K. Sinha" and "R K SINHA" are the same referral.
 *
 * It is a TIE-BREAKER, never a requirement. At this site the bill desk knows the
 * referrer and the scanner often does not (the ERP reads the same field out of
 * either `radiology_worklist.referring_doctor` or the bill, per
 * docs/erp-bridge-billdesk-demographics.md), so a link that demanded agreement
 * would refuse most real matches. It is consulted only when a name and a day
 * already point at more than one candidate.
 */
export function normalizeDoctor(d: string | null | undefined): string {
  return nameTokens((d ?? "").replace(/\bdr\.?\b/gi, " ")).join(" ");
}

// ── demographic link (the join this clinic's machine makes possible) ────────
//
// The USG unit follows no Modality Worklist and writes no accession number, so a
// bill row and its scan share no identifier until CARE's own intake delivers one.
// What they DO share is the patient's name, the scanning day and — when both
// sides know it — the doctor's reference. That is enough to LINK a study to the
// row CARE already sent, and it is not enough to merge two patients' records, so
// this function only ever writes a StudyInstanceUID onto an existing bill row,
// and only when one row and one study point at each other.

export type DemographicOrder = {
  id: string;
  patientName: string;
  studyDate: Date | null;
  referringDoctor?: string | null;
};

export type DemographicStudy = {
  studyInstanceUid: string;
  patientName?: string | null;
  /** `yyyy-mm-dd` as the DICOM header gave it. */
  studyDate?: string | null;
  referringDoctor?: string | null;
};

export type DemographicPlan = {
  links: { orderId: string; studyInstanceUid: string }[];
  /** Name + day agreed, but more than one row or more than one study did. */
  ambiguous: number;
  /** A bill row with no study date: nothing to place the scan on. */
  skippedNoDay: number;
};

/**
 * Decide which scans may be written onto which bill rows, by demographics.
 *
 * One order and one study for the same name on the same clinic day → link.
 * Anything else (two scans that day, two bills that day, or both) is refused
 * unless the doctor's reference name picks exactly one of the candidates — and
 * if it cannot, nothing is guessed. A wrong link would put this patient's
 * pictures inside another patient's report, which is the one error here that
 * cannot be talked out of the record afterwards.
 */
export function planDemographicLinks(
  orders: DemographicOrder[],
  studies: DemographicStudy[],
): DemographicPlan {
  const links: { orderId: string; studyInstanceUid: string }[] = [];
  let ambiguous = 0;
  let skippedNoDay = 0;

  const ordersByKey = new Map<string, DemographicOrder[]>();
  for (const o of orders) {
    const key = nameDayKey(o.patientName, istDayOfDate(o.studyDate));
    if (!key) {
      skippedNoDay++;
      continue;
    }
    const list = ordersByKey.get(key);
    if (list) list.push(o);
    else ordersByKey.set(key, [o]);
  }

  const studiesByKey = new Map<string, DemographicStudy[]>();
  for (const s of studies) {
    const uid = (s.studyInstanceUid ?? "").trim();
    if (!uid) continue;
    const key = nameDayKey(s.patientName, s.studyDate);
    if (!key) continue;
    const list = studiesByKey.get(key);
    if (list) list.push(s);
    else studiesByKey.set(key, [s]);
  }

  // Only the doctor's name can separate two same-named patients on one day, and
  // only when BOTH sides recorded it. Used as a filter, so a missing value on
  // either side leaves the candidate set unchanged rather than emptying it.
  const byDoctor = <T extends { referringDoctor?: string | null }>(
    items: T[],
    against: string | null | undefined,
  ): T[] => {
    const want = normalizeDoctor(against);
    if (!want) return items;
    return items.filter((i) => normalizeDoctor(i.referringDoctor) === want);
  };

  for (const [key, orderList] of ordersByKey) {
    const studyList = studiesByKey.get(key);
    if (!studyList?.length) continue;

    if (orderList.length === 1 && studyList.length === 1) {
      links.push({ orderId: orderList[0]!.id, studyInstanceUid: studyList[0]!.studyInstanceUid });
      continue;
    }
    if (orderList.length === 1) {
      const picked = byDoctor(studyList, orderList[0]!.referringDoctor);
      if (picked.length === 1) {
        links.push({ orderId: orderList[0]!.id, studyInstanceUid: picked[0]!.studyInstanceUid });
      } else ambiguous++;
      continue;
    }
    if (studyList.length === 1) {
      const picked = byDoctor(orderList, studyList[0]!.referringDoctor);
      if (picked.length === 1) {
        links.push({ orderId: picked[0]!.id, studyInstanceUid: studyList[0]!.studyInstanceUid });
      } else ambiguous++;
      continue;
    }
    ambiguous++;
  }

  return { links, ambiguous, skippedNoDay };
}

/**
 * One short, PHI-free line describing why Prisma rejected a write.
 *
 * Prisma's message opens with a blank line and a boilerplate header, and puts
 * the actionable text LAST ("Unknown argument `testCode`", "Unique constraint
 * failed on …"). Reading `message.split("\n")[0]` therefore printed nothing at
 * all: 1369 rejected inserts reported "create failed ()" for four days while
 * the studio looked healthy, because a stale generated client was refusing
 * every write and the diagnostic was empty.
 *
 * Only the last line is taken: that is where Prisma names the offending
 * argument or constraint, and it is never the echoed `data:` block — so
 * submitted patient values stay out of the log.
 */
export function prismaErrorSummary(e: unknown): string {
  if (!(e instanceof Error)) return "unknown";
  const lines = e.message.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const detail = lines.length ? (lines[lines.length - 1] as string) : "unknown";
  const code = (e as { code?: unknown }).code;
  const prefix = typeof code === "string" && code ? `${code} · ` : "";
  return `${prefix}${detail}`.slice(0, 120);
}

// ── DB orchestration ────────────────────────────────────────────────────────

type CareOrderRow = {
  id: string;
  accessionNumber: string | null;
  careWorklistId: string | null;
  studyInstanceUid: string | null;
  status: string;
  patientName: string;
  patientAge: string;
  patientSex: string;
  patientPhone: string;
  patientAddress: string;
  billNumber: string;
  referringDoctor: string;
  testName: string;
  testCode: string;
  billingStatus: string | null;
  billingUpdatedAt: Date | null;
  studyDate: Date | null;
};

/**
 * Import CARE worklist rows (already fetched) into UsgCareOrder.
 *
 * Deterministic upsert: resolve the existing row by careWorklistId
 * (oldest-first) then by non-blank accessionNumber; create otherwise.
 * REPORTED rows are frozen (their demographics and links are the day's
 * record) — resync can never reset a finalized/reporting state.
 */
/** ERP sends date-only today; accepts optional DICOM HHMMSS when any source supplies it.
 *  No time  -> midnight UTC (unchanged behaviour). With time -> IST wall time converted to UTC. */
function parseStudyDateTime(dateStr: string | null | undefined, timeStr?: string | null): Date | null {
  const d = (dateStr ?? "").replace(/[^0-9]/g, "");
  if (d.length < 8) return null;
  const t = (timeStr ?? "").replace(/[^0-9]/g, "");
  const hh = t.length >= 2 ? Number(t.slice(0, 2)) : 0;
  const mm = t.length >= 4 ? Number(t.slice(2, 4)) : 0;
  const ss = t.length >= 6 ? Number(t.slice(4, 6)) : 0;
  const istMs = t.length >= 4 ? (5 * 60 + 30) * 60 * 1000 : 0;
  const utc = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)), hh, mm, ss) - istMs;
  const dt = new Date(utc);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
export async function importCareRows(rows: CareWorklistItem[], clinicId: string = "default"): Promise<SyncStats> {
  const stats = emptySyncStats();
  stats.careRowsReceived = rows.length;

  const usRows = rows.filter((w) => {
    // v6.14: check modality first; if null/empty, check testName as fallback.
    // Some ERPs don't fill the modality field but the testName contains
    // "USG"/"Ultrasound"/"Doppler"/"Echo" etc.
    if (isUltrasoundModality(w.modality)) return true;
    if (!w.modality || !w.modality.trim()) {
      const tn = `${careTestName(w)} ${careTestCode(w)}`.toLowerCase();
      if (/usg|ultrasound|sonograph|doppler|echo|fetal|antenatal|obstetric|growth scan|whole abdomen|kub|thyroid|breast|scrotum|tvs|trus|prostate|renal/.test(tn)) return true;
    }
    return false;
  });
  stats.ultrasoundRowsReceived = usRows.length;

  // Bulk-load existing orders once; single-clinic scale (hundreds).
  // v6.10 — scoped by clinicId so a multi-clinic install never imports
  // another clinic's orders into the active clinic.
  const existingOrders = (await db.usgCareOrder.findMany({
    where: { clinicId },
    orderBy: { createdAt: "asc" },
  })) as CareOrderRow[];

  const byWlId = new Map<string, CareOrderRow>();
  for (const o of existingOrders) {
    if (o.careWorklistId && !byWlId.has(o.careWorklistId)) byWlId.set(o.careWorklistId, o); // oldest first
  }
  const byAcc = new Map<string, CareOrderRow>();
  for (const o of existingOrders) {
    if (o.accessionNumber && !byAcc.has(o.accessionNumber)) byAcc.set(o.accessionNumber, o);
  }
  // StudyInstanceUID bridge: Orthanc-orphan imports land with a UID and no
  // careWorklistId; when CARE later sends the billed row with the same UID,
  // we must UPDATE that orphan — never create a duplicate.
  const byUid = new Map<string, CareOrderRow>();
  for (const o of existingOrders) {
    if (o.studyInstanceUid && !byUid.has(o.studyInstanceUid)) byUid.set(o.studyInstanceUid, o);
  }

  for (const w of usRows) {
    const n = normalizeCareRow(w);
    const decision = decideImport(n);
    if (decision.kind === "skip") {
      if (decision.reason === "noName") {
        stats.skippedNoName++;
        stats.skippedReasons.push(`WL ${n.wlId ?? n.acc ?? "?"}: no patient name`);
      } else {
        stats.skippedMissingIdentity++;
        stats.skippedReasons.push(`WL ${n.wlId ?? n.bill ?? "?"}: no stable identity (worklistId / accession / StudyInstanceUID / billNumber all absent)`);
      }
      continue;
    }

    const existing = n.wlId ? byWlId.get(n.wlId) ?? null : null;
    const legacy = !existing && n.acc ? byAcc.get(n.acc) ?? null : null;
    const byStudy = !existing && !legacy && n.uid ? byUid.get(n.uid) ?? null : null;
    const target = existing ?? legacy ?? byStudy;
    const { age, sex } = splitAgeSex(w.patientAge);
    // v6.15 — Age plausibility guard: reject garbage (e.g. 126) from ERP
    const plausibleAge = (age: string | null): string | null => {
      if (!age) return null;
      const n = Number(age.replace(/[^0-9]/g, ""));
      return Number.isFinite(n) && n >= 0 && n <= 110 ? String(Math.round(n)) : null;
    };
    const validAge = plausibleAge(age) ?? "";

    try {
      if (target) {
        if (target.status === "REPORTED") {
          // The day's record stays frozen — resync never resets state.
          // (Local freeze: applies whether the ERP sent ?status=pending
          // or ?status=all. The doctor finalized here; nothing to do.)
          stats.alreadyReported++;
        } else if (isErpFinalized(n.erpStatus)) {
          // v6.14.1 ERP freeze: the ERP says REPORT_FINAL / DELIVERED for
          // this worklistId, but the studio hasn't finalized locally.
          // Don't overwrite local demographics OR bump the local status —
          // the doctor needs to see this case in the worklist so they can
          // reconcile (either finalize here too, or mark as "done elsewhere").
          // Counted separately so the audit trail distinguishes the two
          // "already done" paths (local vs ERP-side).
          stats.erpFinalizedNotLocal++;
          stats.skippedReasons.push(
            `WL ${n.wlId ?? n.acc ?? "?"}: ERP already REPORT_FINAL — not overwriting local state`,
          );
        } else {
          await db.usgCareOrder.update({
            where: { id: target.id },
            data: {
              // Never blank a populated accession (ERP may send "" late);
              // never fabricate one either — null stays null until CARE says.
              accessionNumber: n.acc ?? target.accessionNumber,
              patientName: n.name || target.patientName,
              patientAge: validAge || target.patientAge,
              patientSex: sex || target.patientSex,
              // v6.2 blanking guard: the ERP sends "" (empty STRING, not
              // null) for demographics it does not know — `??` would let a
              // blank overwrite a value an earlier sync (or the bill desk
              // extension) had stored. `||` keeps what we have.
              patientPhone: w.patientPhone || target.patientPhone,
              patientAddress: w.patientAddress || target.patientAddress,
              billNumber: w.billNumber || target.billNumber,
              referringDoctor: w.referringDoctor || target.referringDoctor,
              testName: careTestName(w) || target.testName,
              testCode: careTestCode(w) || target.testCode,
              billingStatus: w.billingStatus ?? target.billingStatus,
              billingUpdatedAt: w.billingStatus ? new Date() : undefined,
              careWorklistId: n.wlId ?? target.careWorklistId,
              studyInstanceUid: n.uid ?? target.studyInstanceUid,
              studyDate: parseStudyDateTime(w.studyDate, (w as any).studyTime) ?? target.studyDate,
            },
          });
          stats.updatedExisting++;
        }
      } else {
        // v6.14.1: even for brand-new rows, if the ERP already considers
        // this case REPORT_FINAL / DELIVERED, import it but freeze the
        // local status at REPORTED so the studio doesn't try to finalize
        // it again. The doctor can reopen if they want to amend.
        const isErpDone = isErpFinalized(n.erpStatus);
        const created = (await db.usgCareOrder.create({
          data: {
            clinicId,
            accessionNumber: n.acc,
            careWorklistId: n.wlId,
            patientName: n.name,
            patientAge: validAge,
            patientSex: sex || "F",
            patientPhone: w.patientPhone ?? "",
            patientAddress: w.patientAddress ?? "",
            billNumber: w.billNumber ?? "",
            referringDoctor: w.referringDoctor ?? "",
            testName: careTestName(w),
            testCode: careTestCode(w),
            modality: "USG",
            studyInstanceUid: n.uid,
            billingStatus: w.billingStatus ?? null,
            studyDate: parseStudyDateTime(w.studyDate, (w as any).studyTime),
            // v6.14.1: if the ERP already finalized, mirror that locally so
            // the studio's finalize button is hidden. careSyncedAt is left
            // null so the audit trail shows "imported as already-finalized".
            status: isErpDone ? "REPORTED" : "PENDING",
          },
        })) as CareOrderRow;
        stats.imported++;
        if (isErpDone) {
          stats.erpFinalizedNotLocal++;
          stats.skippedReasons.push(
            `WL ${n.wlId ?? n.acc ?? "?"}: imported as REPORTED (ERP already REPORT_FINAL)`,
          );
        }
        if (created.careWorklistId) byWlId.set(created.careWorklistId, created);
        if (created.accessionNumber) byAcc.set(created.accessionNumber, created);
        if (created.studyInstanceUid) byUid.set(created.studyInstanceUid, created);
      }
    } catch (e) {
      // e.g. an accession the ERP reassigned to a different row (unique
      // collision on update). Counted, never fatal, never merged.
      stats.errors++;
      stats.skippedReasons.push(
        `WL ${n.wlId ?? "?"}: write rejected (${prismaErrorSummary(e)})`,
      );
    }
  }
  return stats;
}

/**
 * The outage safety net: studies sitting in Orthanc that CARE has not served.
 *
 * It is NOT a second feed, and it must never be read as one. Every scanned
 * patient at this clinic is billed in CARE; the USG machine simply follows no
 * Modality Worklist and writes no accession number, so a study only reaches the
 * studio's list when CARE's bridge hands over its row. When CARE is not
 * answering — a rejected write, a stalled pull, the container being down — the
 * patient still has to be reportable, and this is how.
 *
 * Rules, and why each one is there:
 *   - identity is the StudyInstanceUID alone; a patient who already has a
 *     bill-desk row on that scanning day is never given a second, emptier one
 *     (`nameDayKey`: sorted name tokens + the clinic's IST day);
 *   - nothing bill-shaped is invented: no accession is copied off the DICOM
 *     header (CARE owns that column and it is UNIQUE table-wide — an orphan that
 *     claimed one first made CARE's own row impossible to create, 67 lost
 *     studies on the NAS), no synthetic worklist id, no test name;
 *   - bounded by {@link ORPHAN_MAX_AGE_DAYS}; yesterday's archive is not today's
 *     worklist;
 *   - when CARE later serves the same UID, importCareRows adopts THIS row by the
 *     UID bridge and fills in the real worklist id, accession, test and
 *     demographics — the stopgap reconciles instead of lingering as a twin.
 *
 * What remains a scan with no bill is a real gap upstream: CARE's mirror row is
 * written only by the Orthanc→ERP intake (`care-pacs/care-erp-sync`), so a study
 * the ERP never learned about has nothing for the studio to join to.
 */
export async function importOrthancOrphans(
  studies: OrthancUsStudyRow[],
  clinicId: string = "default",
): Promise<OrphanImportStats> {
  const stats = emptyOrphanImportStats();
  stats.orthancUsStudies = studies.length;
  if (!studies.length) return stats;

  const existing = await db.usgCareOrder.findMany({
    where: { clinicId, studyInstanceUid: { not: null } },
    select: { studyInstanceUid: true },
  });
  const haveUid = new Set(
    existing.map((o) => o.studyInstanceUid).filter((u): u is string => !!u),
  );

  const billedOrders = await db.usgCareOrder.findMany({
    where: { clinicId, careWorklistId: { not: null } },
    select: { patientName: true, studyDate: true },
  });
  const billedDayKeys = new Set(
    billedOrders
      .map((o) => nameDayKey(o.patientName, istDayOfDate(o.studyDate)))
      .filter((k): k is string => !!k),
  );
  const oldestAcceptedYmd = addCalendarDaysYmd(clinicTodayIST(), -ORPHAN_MAX_AGE_DAYS);

  for (const st of studies) {
    const uid = clean(st.studyInstanceUid);
    if (!uid) {
      stats.skippedNoUid++;
      continue;
    }
    if (haveUid.has(uid)) {
      stats.alreadyPresent++;
      continue;
    }
    const name = (st.patientName ?? "").trim();
    if (!name || name.toUpperCase() === "UNKNOWN") {
      // UNKNOWN is the DICOMweb fallback when PatientName is blank — not safe
      // to put on a reporting worklist without a human identity.
      stats.skippedNoName++;
      continue;
    }

    // Bounded fallback: yesterday's archive is not today's worklist.
    if (st.studyDate && st.studyDate < oldestAcceptedYmd) {
      stats.skippedTooOld++;
      continue;
    }
    if (billedDayKeys.has(nameDayKey(name, st.studyDate) ?? "")) {
      stats.skippedBilledRowExists++;
      continue;
    }

    // What a scan may claim about itself: who the patient is, whose reference
    // it was, and the Study UID that reaches the images. The exam name is left
    // blank rather than invented — an un-billed row has no catalogued test, and
    // the doctor choosing the study in the composer is the honest answer.
    try {
      await db.usgCareOrder.create({
        data: {
          clinicId,
          accessionNumber: null,
          careWorklistId: null,
          patientName: name,
          patientAge: (st.patientAge ?? "").replace(/[^0-9]/g, "").slice(0, 3),
          patientSex: st.patientSex === "M" ? "M" : "F",
          patientPhone: "",
          patientAddress: "",
          billNumber: "",
          referringDoctor: (st.referringDoctor ?? "").trim(),
          testName: (st.testName ?? "").trim(),
          testCode: "",
          modality: "USG",
          studyInstanceUid: uid,
          studyDate: parseStudyDateTime(st.studyDate, st.studyTime),
          billingStatus: null,
          status: "PENDING",
        },
      });
      stats.importedFromOrthanc++;
      haveUid.add(uid);
    } catch (e) {
      stats.errors++;
      // Safe diagnostics: study UID tail + error class, never patient data.
      stats.skippedReasons.push(`UID ..${uid.slice(-8)}: create failed (${prismaErrorSummary(e)})`);
    }
  }
  return stats;
}

/**
 * Project the chunked DICOMweb ultrasound rows onto the Orthanc REST shape the
 * attach pass matches against.
 *
 * The Orthanc study id is not an identity anyone persists here — the UID is —
 * so the UID stands in for it. Accession stays null when absent rather than
 * becoming "", which is the difference between "no accession" and an
 * accession that collides with every other blank one.
 */
export function orthancRowsToStudies(rows: OrthancUsStudyRow[]): OrthancStudy[] {
  const out: OrthancStudy[] = [];
  for (const r of rows) {
    const uid = clean(r.studyInstanceUid);
    if (!uid) continue;
    out.push({
      ID: uid,
      MainDicomTags: {
        StudyInstanceUID: uid,
        AccessionNumber: clean(r.accessionNumber) ?? "",
        StudyDate: r.studyDate ?? "",
        StudyTime: r.studyTime ?? "",
        StudyDescription: r.testName ?? "",
      },
    });
  }
  return out;
}

/**
 * Attach Orthanc studies to CARE orders — exact identity matching only.
 *
 * StudyInstanceUID (first): the order already carries the DICOM identity,
 * either from CARE or a previous attach — matching confirms the link.
 * AccessionNumber (second): exactly ONE Orthanc study may match; two or
 * more is ambiguous and skipped (no "first match", no names, ever).
 */
export async function attachOrthancStudies(studies: OrthancStudy[], clinicId: string = "default"): Promise<AttachStats> {
  const stats = emptyAttachStats();
  stats.orthancStudies = studies.length;

  const { byUid, byAcc } = indexOrthancStudies(studies);
  // v6.10 — scope by clinicId so we only attach studies to this clinic's orders.
  const orders = (await db.usgCareOrder.findMany({ where: { clinicId } })) as CareOrderRow[];
  const matchedStudyIds = new Set<string>();

  for (const order of orders) {
    const m = matchOrthancStudy(order, byUid, byAcc);
    if (m.kind === "studyUid") {
      stats.matchedByStudyUid++;
      matchedStudyIds.add(m.study.ID);
      // A part 2: Enrich with DICOM StudyTime if present
      const stDate = m.study.MainDicomTags?.StudyDate;
      const stTime = m.study.MainDicomTags?.StudyTime;
      if (stDate && stTime) {
        const preciseDate = parseStudyDateTime(stDate, stTime);
        if (preciseDate && order.studyDate && preciseDate.getTime() !== order.studyDate.getTime()) {
          await db.usgCareOrder.update({ where: { id: order.id }, data: { studyDate: preciseDate } });
        }
      }
    } else if (m.kind === "accession") {
      const uid = clean(m.study.MainDicomTags?.StudyInstanceUID);
      if (uid) {
        // Only attach when the study carries its own StudyInstanceUID —
        // that is what every downstream images/SR call is keyed by.
        if (order.studyInstanceUid !== uid) {
          await db.usgCareOrder.update({
            where: { id: order.id },
            data: { studyInstanceUid: uid },
          });
        }
        stats.matchedByAccession++;
        matchedStudyIds.add(m.study.ID);
        // A part 2: Enrich with DICOM StudyTime if present
        const stDate = m.study.MainDicomTags?.StudyDate;
        const stTime = m.study.MainDicomTags?.StudyTime;
        if (stDate && stTime) {
          const preciseDate = parseStudyDateTime(stDate, stTime);
          if (preciseDate && order.studyDate && preciseDate.getTime() !== order.studyDate.getTime()) {
            await db.usgCareOrder.update({ where: { id: order.id }, data: { studyDate: preciseDate } });
          }
        }
      }
    } else if (m.kind === "ambiguous") {
      stats.ambiguousMatches++;
    } else {
      // Two different things, and reading them as one invented a PACS outage.
      if (order.studyInstanceUid) {
        stats.uidOutsideSweep++;
      } else if (order.status !== "REPORTED") {
        // No identifier at all — this row really is waiting for its images.
        stats.awaitingImages++;
      }
    }
  }

  for (const st of studies) {
    if (!matchedStudyIds.has(st.ID)) stats.unmatchedOrthanc++;
  }
  return stats;
}

export type DemographicLinkStats = {
  linked: number;
  ambiguous: number;
  skippedNoDay: number;
  errors: number;
  /** Safe per-link diagnostics — order id + reason, never patient data. */
  reasons: string[];
};

/**
 * Write a scan's StudyInstanceUID onto the CARE bill row it belongs to, by
 * demographics — the join this clinic's machine makes necessary (no MWL, no
 * accession) and the only join that ever writes bill fields here is CARE itself.
 *
 * Runs after the identifier passes, so it can never override a UID or accession
 * match, and before the safety net, so a study that reaches its own bill row
 * does not also get a duplicate row. It touches `studyInstanceUid` and nothing
 * else: no name, no test, no status, no accession. A wrong link would put this
 * patient's pictures inside another patient's report, so anything that is not a
 * unique hit is left unlinked and COUNTED — see planDemographicLinks.
 */
export async function linkOrdersByDemography(
  studies: DemographicStudy[],
  clinicId: string = "default",
): Promise<DemographicLinkStats> {
  const stats: DemographicLinkStats = { linked: 0, ambiguous: 0, skippedNoDay: 0, errors: 0, reasons: [] };
  if (!studies.length) return stats;

  const unlinked = await db.usgCareOrder.findMany({
    where: { clinicId, studyInstanceUid: null },
    select: { id: true, patientName: true, studyDate: true, referringDoctor: true },
  });
  if (!unlinked.length) return stats;

  const plan = planDemographicLinks(unlinked, studies);
  stats.ambiguous = plan.ambiguous;
  stats.skippedNoDay = plan.skippedNoDay;

  for (const link of plan.links) {
    try {
      await db.usgCareOrder.update({
        where: { id: link.orderId },
        data: { studyInstanceUid: link.studyInstanceUid },
      });
      stats.linked++;
    } catch (e) {
      stats.errors++;
      stats.reasons.push(`order ${link.orderId.slice(-8)}: link failed (${prismaErrorSummary(e)})`);
    }
  }
  return stats;
}

/** Orders whose images have not arrived yet (worklist "Awaiting images"). */
export function isAwaitingImages(order: { studyInstanceUid: string | null }): boolean {
  return !order.studyInstanceUid;
}

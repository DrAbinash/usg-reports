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
import { UNNAMED_STUDY_PLACEHOLDER } from "./billedStudyType";

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
  awaitingImages: number;
  unmatchedOrthanc: number;
};

export const emptyAttachStats = (): AttachStats => ({
  orthancStudies: 0,
  matchedByStudyUid: 0,
  matchedByAccession: 0,
  ambiguousMatches: 0,
  awaitingImages: 0,
  unmatchedOrthanc: 0,
});

/** Stats for importing Orthanc US studies that have no CARE order yet. */
export type OrphanImportStats = {
  orthancUsStudies: number;
  importedFromOrthanc: number;
  alreadyPresent: number;
  skippedNoName: number;
  skippedNoUid: number;
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
  errors: 0,
  skippedReasons: [],
});

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Error &&
  ((e as { code?: string }).code === "P2002" || /unique constraint/i.test(e.message));

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
        `WL ${n.wlId ?? "?"}: database constraint (${e instanceof Error ? e.message.split("\n")[0].slice(0, 80) : "unknown"})`,
      );
    }
  }
  return stats;
}

/**
 * Import Orthanc ultrasound studies that are not yet linked to any CARE
 * order. Identity = StudyInstanceUID only (never names). Creates PENDING
 * UsgCareOrder rows so the radiologist can report walk-in / unlinked PACS
 * studies without waiting for bill-desk linking.
 *
 * Idempotent: an existing order with the same UID is left alone (counted
 * as alreadyPresent). Accession is stored when Orthanc has a single clear
 * value; blank accessions stay null (never synthesized).
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

  // Also avoid unique-collision on accession when an order already holds it.
  // The unique constraint is TABLE-WIDE (accessionNumber @unique), so this
  // lookup must be too — a clinic-scoped version let an accession owned by
  // another clinic's order fail every create with a swallowed error
  // (NAS-verified: 67 of 145 fetched US studies lost this way).
  const existingAcc = await db.usgCareOrder.findMany({
    where: { accessionNumber: { not: null } },
    select: { accessionNumber: true },
  });
  const haveAcc = new Set(
    existingAcc.map((o) => o.accessionNumber).filter((a): a is string => !!a),
  );

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

    const acc = clean(st.accessionNumber);
    // If another order already owns this accession, keep accession null on
    // the orphan (UID is enough) rather than failing the unique constraint.
    const safeAcc = acc && !haveAcc.has(acc) ? acc : null;

    const data = {
      clinicId,
      accessionNumber: safeAcc,
      careWorklistId: null,
      patientName: name,
      patientAge: (st.patientAge ?? "").replace(/[^0-9]/g, "").slice(0, 3),
      patientSex: st.patientSex === "M" ? "M" : "F",
      patientPhone: "",
      patientAddress: "",
      billNumber: "",
      referringDoctor: (st.referringDoctor ?? "").trim(),
      testName: (st.testName ?? "").trim() || UNNAMED_STUDY_PLACEHOLDER,
      testCode: "",
      modality: "USG",
      studyInstanceUid: uid,
      studyDate: parseStudyDateTime(st.studyDate, st.studyTime),
      billingStatus: null,
      status: "PENDING",
    };

    try {
      await db.usgCareOrder.create({ data });
      stats.importedFromOrthanc++;
      haveUid.add(uid);
      if (safeAcc) haveAcc.add(safeAcc);
    } catch (e) {
      // After the table-wide guard, what's left is a race with a concurrent
      // sync claiming the accession between our lookup and this insert.
      // Retry once with the accession dropped — the UID is the orphan's
      // real identity — before counting the failure.
      let saved = false;
      if (safeAcc && isUniqueViolation(e)) {
        try {
          await db.usgCareOrder.create({ data: { ...data, accessionNumber: null } });
          saved = true;
        } catch {
          // fall through — the original failure is what gets counted
        }
      }
      if (saved) {
        stats.importedFromOrthanc++;
        haveUid.add(uid);
      } else {
        stats.errors++;
        // Safe diagnostics: study UID tail + error class, never patient data.
        stats.skippedReasons.push(
          `UID ..${uid.slice(-8)}: create failed (${e instanceof Error ? e.message.split("\n")[0].slice(0, 60) : "unknown"})`,
        );
      }
    }
  }
  return stats;
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
      // No Orthanc link (yet) — the order stays visible as "Awaiting images".
      if (order.status !== "REPORTED") stats.awaitingImages++;
    }
  }

  for (const st of studies) {
    if (!matchedStudyIds.has(st.ID)) stats.unmatchedOrthanc++;
  }
  return stats;
}

/** Orders whose images have not arrived yet (worklist "Awaiting images"). */
export function isAwaitingImages(order: { studyInstanceUid: string | null }): boolean {
  return !order.studyInstanceUid;
}

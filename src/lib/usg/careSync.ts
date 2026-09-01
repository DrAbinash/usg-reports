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
import { isUltrasoundModality, splitAgeSex, type CareWorklistItem } from "./careClient";
import type { OrthancStudy } from "./orthancClient";

// ── pure row normalisation ──────────────────────────────────────────────────

export type NormalizedCareRow = {
  name: string;
  wlId: string | null;
  acc: string | null;
  uid: string | null;
};

const clean = (v: string | null | undefined): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

/** Trim the ERP payload into the three stable identities + the name. */
export function normalizeCareRow(w: CareWorklistItem): NormalizedCareRow {
  return {
    name: (w.patientName ?? "").trim(),
    wlId: clean(w.worklistId),
    acc: clean(w.accessionNumber),
    uid: clean(w.studyInstanceUid),
  };
}

export type ImportDecision =
  | { kind: "skip"; reason: "noName" | "missingIdentity" }
  | { kind: "import" };

/**
 * Import gate: a patient name plus at least one stable identifier.
 * Blank-accession rows with a worklistId or StudyInstanceUID are the ERP's
 * normal output and MUST import; rows with no identity at all are skipped
 * with a counted reason (there is nothing safe to dedup them by).
 */
export function decideImport(n: NormalizedCareRow): ImportDecision {
  if (!n.name) return { kind: "skip", reason: "noName" };
  if (!n.wlId && !n.acc && !n.uid) return { kind: "skip", reason: "missingIdentity" };
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
export async function importCareRows(rows: CareWorklistItem[]): Promise<SyncStats> {
  const stats = emptySyncStats();
  stats.careRowsReceived = rows.length;

  const usRows = rows.filter((w) => isUltrasoundModality(w.modality));
  stats.ultrasoundRowsReceived = usRows.length;

  // Bulk-load existing orders once; single-clinic scale (hundreds).
  const existingOrders = (await db.usgCareOrder.findMany({
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

  for (const w of usRows) {
    const n = normalizeCareRow(w);
    const decision = decideImport(n);
    if (decision.kind === "skip") {
      if (decision.reason === "noName") {
        stats.skippedNoName++;
        stats.skippedReasons.push(`WL ${n.wlId ?? n.acc ?? "?"}: no patient name`);
      } else {
        stats.skippedMissingIdentity++;
        stats.skippedReasons.push(`WL ${n.wlId ?? "?"}: no stable identity (worklistId / accession / StudyInstanceUID all absent)`);
      }
      continue;
    }

    const existing = n.wlId ? byWlId.get(n.wlId) ?? null : null;
    const legacy = !existing && n.acc ? byAcc.get(n.acc) ?? null : null;
    const target = existing ?? legacy;
    const { age, sex } = splitAgeSex(w.patientAge);

    try {
      if (target) {
        if (target.status === "REPORTED") {
          // The day's record stays frozen — resync never resets state.
          stats.alreadyReported++;
        } else {
          await db.usgCareOrder.update({
            where: { id: target.id },
            data: {
              // Never blank a populated accession (ERP may send "" late);
              // never fabricate one either — null stays null until CARE says.
              accessionNumber: n.acc ?? target.accessionNumber,
              patientName: n.name || target.patientName,
              patientAge: age || target.patientAge,
              patientSex: sex || target.patientSex,
              // v6.2 blanking guard: the ERP sends "" (empty STRING, not
              // null) for demographics it does not know — `??` would let a
              // blank overwrite a value an earlier sync (or the bill desk
              // extension) had stored. `||` keeps what we have.
              patientPhone: w.patientPhone || target.patientPhone,
              patientAddress: w.patientAddress || target.patientAddress,
              billNumber: w.billNumber || target.billNumber,
              referringDoctor: w.referringDoctor || target.referringDoctor,
              testName: w.testName || target.testName,
              billingStatus: w.billingStatus ?? target.billingStatus,
              billingUpdatedAt: w.billingStatus ? new Date() : undefined,
              careWorklistId: n.wlId ?? target.careWorklistId,
              studyInstanceUid: n.uid ?? target.studyInstanceUid,
              studyDate: w.studyDate ? new Date(w.studyDate) : target.studyDate,
            },
          });
          stats.updatedExisting++;
        }
      } else {
        const created = (await db.usgCareOrder.create({
          data: {
            accessionNumber: n.acc,
            careWorklistId: n.wlId,
            patientName: n.name,
            patientAge: age,
            patientSex: sex || "F",
            patientPhone: w.patientPhone ?? "",
            patientAddress: w.patientAddress ?? "",
            billNumber: w.billNumber ?? "",
            referringDoctor: w.referringDoctor ?? "",
            testName: w.testName ?? "",
            modality: "USG",
            studyInstanceUid: n.uid,
            billingStatus: w.billingStatus ?? null,
            studyDate: w.studyDate ? new Date(w.studyDate) : null,
            status: "PENDING",
          },
        })) as CareOrderRow;
        stats.imported++;
        if (created.careWorklistId) byWlId.set(created.careWorklistId, created);
        if (created.accessionNumber) byAcc.set(created.accessionNumber, created);
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
 * Attach Orthanc studies to CARE orders — exact identity matching only.
 *
 * StudyInstanceUID (first): the order already carries the DICOM identity,
 * either from CARE or a previous attach — matching confirms the link.
 * AccessionNumber (second): exactly ONE Orthanc study may match; two or
 * more is ambiguous and skipped (no "first match", no names, ever).
 */
export async function attachOrthancStudies(studies: OrthancStudy[]): Promise<AttachStats> {
  const stats = emptyAttachStats();
  stats.orthancStudies = studies.length;

  const { byUid, byAcc } = indexOrthancStudies(studies);
  const orders = (await db.usgCareOrder.findMany()) as CareOrderRow[];
  const matchedStudyIds = new Set<string>();

  for (const order of orders) {
    const m = matchOrthancStudy(order, byUid, byAcc);
    if (m.kind === "studyUid") {
      stats.matchedByStudyUid++;
      matchedStudyIds.add(m.study.ID);
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

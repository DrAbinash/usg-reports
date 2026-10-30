import { NextRequest } from "next/server";
import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { careBillingPollEnabled, careFinalizeEnabled, fetchBillingStatus, fetchWorklist, finalizeReport } from "@/lib/usg/careClient";
import { listRecentUltrasoundStudies } from "@/lib/usg/orthancClient";
import {
  attachOrthancStudies,
  emptyAttachStats,
  emptySyncStats,
  importCareRows,
  ORTHANC_SWEEP_DAYS,
  orthancRowsToStudies,
  planWorklistPull,
  SYNC_LOOKBACK_DAYS,
} from "@/lib/usg/careSync";
import { audit } from "@/lib/usg/audit";

/**
 * Worklist sync — three fail-soft steps (v6.1 identity model):
 *   1. CARE bill-desk rows → import ultrasound orders by identity
 *      (careWorklistId first, legacy accession second, StudyInstanceUID
 *      bridge for a scan that was drafted here before it was billed,
 *      never names). Every cycle re-reads the last SYNC_LOOKBACK_DAYS days
 *      and upserts — there is no watermark and nothing to fall behind (see
 *      planWorklistPull for why one was removed). A row rejected this cycle
 *      is served again next cycle.
 *   2. Orthanc studies → attach by exact StudyInstanceUID, then exact
 *      single-hit AccessionNumber; orders without a study stay visible
 *      as "Awaiting images" — nothing disappears silently. Studies with no
 *      bill are NOT written as orders: they stay in the live PACS queue.
 *   3. Billing badge refresh + retry pending finalizes
 *
 * Every decision is counted in the response; skips carry a safe reason
 * (worklistId + reason — never patient data, never secrets).
 */
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();

  const fullSync =
    req.nextUrl.searchParams.get("full") === "1" ||
    req.nextUrl.searchParams.get("full") === "true";

  const s = await getSettings();
  const careConfigured = !!s.careApiBase; // v6.14: only base URL required for trial
  const orthancConfigured = !!s.orthancUrl;
  let careOk = false;
  let orthancOk = false;
  let lastError: string | null = null;

  let importStats = emptySyncStats();
  let attachStats = emptyAttachStats();

  // 1. CARE worklist → import ultrasound orders by identity
  let backfillRan = false;
  let priorDeepPullAt: Date | null = null;
  if (careConfigured) {
    const priorSync = await db.usgSyncState.findUnique({ where: { clinicId } });
    priorDeepPullAt = priorSync?.lastDeepPullAt ?? null;
    const localOrders = await db.usgCareOrder.count({ where: { clinicId } });
    const pull = planWorklistPull({ fullRequested: fullSync, localOrders, nowMs: Date.now() });
    backfillRan = pull.full;
    if (pull.full) {
      console.log(
        fullSync
          ? "[sync] backlog pull — operator asked for ?full=1, reading every CARE order the ERP will page out"
          : "[sync] no orders stored — backfilling CARE's backlog instead of a few days",
      );
    }
    const r = await fetchWorklist({ full: pull.full, since: pull.since });
    console.log('[sync] care fetch:', r.ok ? ('ok rows=' + ((r.data as unknown[])?.length ?? 0)) : r.error);
    if (r.ok) {
      careOk = true;
      try {
        importStats = await importCareRows(r.data, clinicId);
      } catch (e: any) {
        lastError = `import failed: ${e?.message ?? String(e)}`;
        console.error('[sync] importCareRows threw:', e);
      }
      if (importStats.errors > 0) {
        // There is no cursor to hold and nothing to pin. The rows that were
        // served but refused by the database are inside this same window, so
        // the next cycle asks CARE for them again — which is the whole
        // difference from the design this replaced, where a rejected row could
        // stall the backlog behind it indefinitely.
        lastError =
          lastError ??
          `${importStats.errors} CARE order(s) failed to write — they are served again next cycle (${SYNC_LOOKBACK_DAYS}-day window)`;
        console.warn(`[sync] ${lastError}`);
      }
    } else {
      lastError = r.error;
    }
  }

  // 2. Orthanc → attach images to existing orders by exact identity. ONE
  // chunked DICOMweb date-range query; the attach pass used to call
  // listStudies() as well, which fetched every study id and then issued one
  // HTTP GET per study — ~1400 requests, each re-reading the settings row —
  // on every sync, every two minutes, against a SQLite file with one writer.
  //
  // A study with no bill behind it is NOT imported as an order any more. It
  // never was a bill: the row carried no worklist id, no bill number and no
  // catalogued test, and on this clinic it grew to 1,218 of 2,301 worklist
  // rows, which is why the list read as unfiltered noise and why a delete
  // script was needed at all. Un-billed scans stay what they are — a scan in
  // the PACS queue, reached live from DICOMweb by patient details and the
  // referring doctor's name, and draftable from there (UsgPacsQueue →
  // /api/usg/reports/pacs-draft). Nothing is written, so nothing can flood.
  //
  // Fail-soft: a DICOMweb outage must not undo a successful CARE import — but
  // it is never SILENT: it sets lastError so the banner shows amber.
  if (orthancConfigured) {
    const us = await listRecentUltrasoundStudies(ORTHANC_SWEEP_DAYS, 500);
    if (us.ok) {
      orthancOk = true;
      try {
        attachStats = await attachOrthancStudies(orthancRowsToStudies(us.data), clinicId);
      } catch (e: any) {
        lastError = lastError ?? `attach failed: ${e?.message ?? String(e)}`;
        console.error('[sync] attachOrthancStudies threw:', e);
      }
    } else {
      lastError = lastError ?? us.error;
      console.warn("[sync] listRecentUltrasoundStudies:", us.error);
    }
  }

  // 3a. Billing badge refresh for open rows (accession-keyed — blank
  // accessions have no billing join on the ERP side either; fail-soft).
  if (careOk) {
    if (careBillingPollEnabled()) {
      const open = await db.usgCareOrder.findMany({
        where: { status: { in: ["PENDING", "REPORTING"] }, billingStatus: { not: null }, accessionNumber: { not: null } },
        select: { accessionNumber: true },
        take: 40,
      });
      const accessions = open.map((o) => o.accessionNumber).filter((a): a is string => !!a);
      if (accessions.length) {
        const r = await fetchBillingStatus(accessions);
        if (r.ok) {
          for (const [accession, status] of Object.entries(r.data)) {
            await db.usgCareOrder.updateMany({
              where: { accessionNumber: accession },
              data: { billingStatus: status, billingUpdatedAt: new Date() },
            });
          }
        }
        // Billing failure is never the worklist's problem — no lastError.
      }
    }

    // v6.15 — refresh DRAFT report demographics from the bill-desk order when
    // the order learned a better age/referrer AFTER the draft was created.
    {
      const sane = (raw: string | null): string => {
        const n = Number((raw ?? "").replace(/[^0-9]/g, ""));
        return Number.isFinite(n) && n > 0 && n <= 110 ? String(n) : "";
      };
      const draftOrders = await db.usgCareOrder.findMany({
        where: { status: { in: ["PENDING", "REPORTING"] }, reportId: { not: null } },
        select: { id: true, reportId: true, patientAge: true, referringDoctor: true },
        take: 50,
      });
      for (const o of draftOrders) {
        if (!o.reportId) continue;
        const rep = await db.usgReport.findUnique({ where: { id: o.reportId } });
        if (!rep || rep.status !== "DRAFT") continue;
        const newAge = !sane(rep.patientAge) && sane(o.patientAge) ? sane(o.patientAge) : null;
        const orderRef = String(o.referringDoctor ?? "").trim();
        const newRef = !String(rep.referredBy ?? "").trim() && orderRef ? orderRef : null;
        if (newAge || newRef) {
          await db.usgReport.update({
            where: { id: rep.id },
            data: { ...(newAge ? { patientAge: newAge } : {}), ...(newRef ? { referredBy: newRef } : {}) },
          });
        }
      }
    }

    // 3b. Retry pending CARE finalizes. The ERP resolves the order by
    // worklistId first (accession second), so blank-accession orders
    // finalize correctly; we always send both when we have them.
    //
    // CARE_FINALIZE_ENABLED=0 (this deployment) skips the whole queue: the
    // Studio is the record of truth for USG, and the ERP refuses these rows
    // 409 because a PACS-ingested study can never reach match_score GREEN.
    // Rows stay careSyncedAt = NULL, which with the flag off means "never
    // sent, by policy" — it is never stamped with a fake acceptance time.
    if (careFinalizeEnabled()) {
      const pending = await db.usgCareOrder.findMany({
        where: { status: "REPORTED", careSyncedAt: null, reportId: { not: null } },
        take: 10,
      });
      for (const p of pending) {
        const rep = p.reportId ? await db.usgReport.findUnique({ where: { id: p.reportId } }) : null;
        if (!rep) continue;
        const r = await finalizeReport({
          accessionNumber: p.accessionNumber,
          worklistId: p.careWorklistId,
          reportText: {
            technique: rep.technique ?? "",
            findings: rep.findings ?? "",
            impression: rep.impression ?? "",
            recommendation: "",
          },
          radiologistName: s.usgDoctorName || "USG Studio",
          radiologistRegNumber: s.usgDoctorRegNo || undefined,
          finalizedAt: (rep.finalizedAt ?? new Date()).toISOString(),
        });
        if (r.ok) {
          await db.usgCareOrder.update({ where: { id: p.id }, data: { careSyncedAt: new Date() } });
          await audit({
            action: "worklist.careSync",
            reportId: p.reportId ?? undefined,
            patientName: p.patientName,
            detail: `ERP accepted finalize for ${p.accessionNumber ?? `WL ${p.careWorklistId ?? "?"}`}`,
          });
        }
      }
      const stillPending = await db.usgCareOrder.count({ where: { clinicId, status: "REPORTED", careSyncedAt: null } });
      if (stillPending === 0 && lastError && /finalize|pcpndt|match center/i.test(lastError)) {
        lastError = null; // the last blocking finalize flushed
      }
    }
  }

  // `lastSyncAt` is the clock of the last completed cycle — a number for the
  // banner, not a gate. Nothing consults it to decide what to fetch, which is
  // the whole point: a stalled cycle can no longer hide rows behind a promise.
  // `lastDeepPullAt` now records the last backlog read and is written whenever
  // one runs, regardless of how the import went — the old rule stamped it only
  // on a successful advance, so a held cursor left every later cycle believing
  // a repair pull was overdue. `cursorHoldCount` is retired and pinned at 0 so
  // a stale count cannot be misread as a live diagnosis; the column stays,
  // because this database holds clinical records and columns are not dropped
  // for tidiness.
  const completedAt = new Date();
  await db.usgSyncState.upsert({
    where: { clinicId },
    create: {
      id: clinicId === "default" ? "singleton" : clinicId,
      clinicId,
      lastSyncAt: completedAt,
      lastDeepPullAt: backfillRan ? completedAt : priorDeepPullAt,
      cursorHoldCount: 0,
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Not configured — set CARE / Orthanc in Settings → Integrations",
    },
    update: {
      lastSyncAt: completedAt,
      lastDeepPullAt: backfillRan ? completedAt : priorDeepPullAt,
      cursorHoldCount: 0,
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Not configured — set CARE / Orthanc in Settings → Integrations",
    },
  });

  // Observability: counts (and safe skip reasons) in the audit trail and
  // the response. No patient data in the skip reasons, no secrets anywhere.
  const stats = {
    ...importStats,
    ...attachStats,
    skippedReasons: importStats.skippedReasons,
  };
  const skippedTotal = stats.skippedNoName + stats.skippedMissingIdentity + stats.errors;
  const newOrders = stats.imported;
  if (
    newOrders > 0 ||
    skippedTotal > 0 ||
    stats.ambiguousMatches > 0 ||
    stats.erpFinalizedNotLocal > 0
  ) {
    const bits: string[] = [];
    if (stats.imported) bits.push(`${stats.imported} new from CARE`);
    if (stats.updatedExisting) bits.push(`${stats.updatedExisting} refreshed`);
    if (stats.erpFinalizedNotLocal) bits.push(`${stats.erpFinalizedNotLocal} already finalized in ERP`);
    if (stats.matchedByStudyUid) bits.push(`${stats.matchedByStudyUid} linked by StudyInstanceUID`);
    if (stats.matchedByAccession) bits.push(`${stats.matchedByAccession} linked by accession`);
    if (stats.awaitingImages) bits.push(`${stats.awaitingImages} awaiting images`);
    if (skippedTotal) bits.push(`${skippedTotal} skipped`);
    if (stats.ambiguousMatches) bits.push(`${stats.ambiguousMatches} ambiguous accession matches`);
    await audit({
      action: "worklist.sync",
      detail: [bits.join(" · "), ...stats.skippedReasons.slice(0, 5)].filter(Boolean).join(" — "),
    });
  }

  return Response.json({
    ok: true,
    careOk,
    orthancOk,
    careConfigured,
    orthancConfigured,
    newOrders,
    // v6.14.1 — surfaced to the studio UI toast so the doctor sees how many
    // cases the ERP already considers finalized. The UI can render a banner
    // like "5 cases already finalized in ERP — review them" when > 0.
    erpFinalizedNotLocal: stats.erpFinalizedNotLocal,
    lastError,
    stats,
    // `incremental` used to mean "started from the stored watermark". Nothing
    // reads it any more, and the name describes a design that is gone: this
    // response now says plainly which window was read.
    backfill: backfillRan,
    lookbackDays: SYNC_LOOKBACK_DAYS,
    sweptDays: ORTHANC_SWEEP_DAYS,
    syncedAt: new Date().toISOString(),
  });
}

import { NextRequest } from "next/server";
import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { careBillingPollEnabled, careFinalizeEnabled, fetchBillingStatus, fetchWorklist, finalizeReport } from "@/lib/usg/careClient";
import { listRecentUltrasoundStudies } from "@/lib/usg/orthancClient";
import {
  attachOrthancStudies,
  DEEP_PULL_WINDOW_MS,
  emptyAttachStats,
  emptyOrphanImportStats,
  emptySyncStats,
  importCareRows,
  importOrthancOrphans,
  MAX_CURSOR_HOLDS,
  orthancRowsToStudies,
  planCareCursor,
  planWorklistPull,
  worklistPullMode,
  type CareCursorPlan,
} from "@/lib/usg/careSync";
import { audit } from "@/lib/usg/audit";

/** Subtract a small buffer so clock skew between studio and ERP never misses a row. */
const SINCE_BUFFER_MS = 2 * 60 * 1000;

/**
 * Worklist sync — four fail-soft steps (v6.1 identity model + Orthanc orphans):
 *   1. CARE bill-desk rows → import ultrasound orders by identity
 *      (careWorklistId first, legacy accession second, StudyInstanceUID
 *      bridge for prior Orthanc orphans, never names). The watermark this
 *      step writes is CARE's clock and moves only when every served row
 *      landed — see planCareCursor.
 *   2. Orthanc studies → attach by exact StudyInstanceUID, then exact
 *      single-hit AccessionNumber; orders without a study stay visible
 *      as "Awaiting images" — nothing disappears silently
 *   3. Orthanc US orphans (DICOMweb, last 14d queried) → import as PENDING
 *      orders keyed by StudyInstanceUID, but only for the last
 *      ORPHAN_MAX_AGE_DAYS days and only where no bill-desk order already
 *      represents that patient that day. This is the fallback for un-billed
 *      scans, not a second feed.
 *   4. Billing badge refresh + retry pending finalizes
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
  let incremental = false;

  let importStats = emptySyncStats();
  let attachStats = emptyAttachStats();
  let orphanStats = emptyOrphanImportStats();

  // 1. CARE worklist → import ultrasound orders by identity
  let cursorPlan: CareCursorPlan = { action: "advance", at: new Date(), holds: 0, gaveUpAfterHolds: false };
  let deepPullRan = false;
  let priorWatermark: Date | null = null;
  let priorDeepPullAt: Date | null = null;
  if (careConfigured) {
    const priorSync = await db.usgSyncState.findUnique({ where: { clinicId } });
    const watermark = priorSync?.lastSyncAt ?? null;
    priorWatermark = watermark;
    priorDeepPullAt = priorSync?.lastDeepPullAt ?? null;
    const localOrders = await db.usgCareOrder.count({ where: { clinicId } });
    const mode = worklistPullMode({ fullRequested: fullSync, hasWatermark: !!watermark, localOrders });
    const pull = planWorklistPull({
      mode,
      watermark,
      bufferMs: SINCE_BUFFER_MS,
      lastDeepPullAt: priorSync?.lastDeepPullAt ?? null,
      nowMs: Date.now(),
    });
    incremental = !pull.full && !pull.deep;
    // A backfill and a repair pull both re-read rows the watermark believes it
    // has already served, so either one resets the hole-healing timer.
    deepPullRan = pull.full || pull.deep;
    if (pull.full && watermark && !fullSync) {
      console.log("[sync] watermark ignored — lastSyncAt survived but this Studio holds no orders; backfilling");
    }
    if (pull.full) {
      console.log("[sync] backlog pull — re-reading every CARE order the ERP will page out");
    } else if (pull.deep) {
      console.log(`[sync] repair pull — re-reading ${Math.round(DEEP_PULL_WINDOW_MS / 3600000)}h of CARE backlog`);
    }
    const r = await fetchWorklist({ full: pull.full, since: pull.since });
    console.log('[sync] care fetch:', r.ok ? ('ok rows=' + ((r.data as any[])?.length ?? 0)) : r.error);
    if (r.ok) {
      careOk = true;
      let writeFailures = 0;
      try {
        importStats = await importCareRows(r.data, clinicId);
        writeFailures = importStats.errors;
      } catch (e: any) {
        lastError = `import failed: ${e?.message ?? String(e)}`;
        console.error('[sync] importCareRows threw:', e);
        writeFailures = Math.max(1, (r.data as any[])?.length ?? 1);
      }
      cursorPlan = planCareCursor({
        servedThroughAt: r.servedThroughAt,
        writeFailures,
        holds: priorSync?.cursorHoldCount ?? 0,
        nowMs: Date.now(),
      });
      if (cursorPlan.action === "hold") {
        lastError = `${writeFailures} CARE order(s) failed to write — sync cursor held at ${
          watermark ? watermark.toISOString() : "the beginning"
        } so they arrive again (hold ${cursorPlan.holds}/${MAX_CURSOR_HOLDS})`;
        console.warn(`[sync] ${lastError}`);
      } else if (cursorPlan.gaveUpAfterHolds) {
        lastError = `${writeFailures} CARE order(s) failed to write after ${MAX_CURSOR_HOLDS} retries — cursor advanced, run a full sync`;
        console.error(`[sync] ${lastError}`);
      }
    } else {
      lastError = r.error;
      // Nothing was served, so nothing may be marked as served.
      cursorPlan = { action: "hold", holds: priorSync?.cursorHoldCount ?? 0 };
    }
  } else {
    cursorPlan = { action: "hold", holds: 0 };
  }

  // 2 + 3. Orthanc → attach images to existing orders by exact identity, then
  // import the ultrasound studies that have no order yet. ONE chunked DICOMweb
  // date-range query feeds both passes. The attach pass used to call
  // listStudies() as well, which fetched every study id and then issued one
  // HTTP GET per study — ~1400 requests, each re-reading the settings row —
  // on every sync, every two minutes, against a SQLite file with one writer.
  //
  // Fail-soft: a DICOMweb outage must not undo a successful CARE import — but
  // it is never SILENT: it sets lastError so the banner shows amber.
  if (orthancConfigured) {
    const us = await listRecentUltrasoundStudies(14, 500);
    if (us.ok) {
      orthancOk = true;
      try {
        attachStats = await attachOrthancStudies(orthancRowsToStudies(us.data), clinicId);
      } catch (e: any) {
        lastError = lastError ?? `attach failed: ${e?.message ?? String(e)}`;
        console.error('[sync] attachOrthancStudies threw:', e);
      }
      try {
        orphanStats = await importOrthancOrphans(us.data, clinicId);
        console.log(
          "[sync] orthanc orphans:",
          `us=${orphanStats.orthancUsStudies}`,
          `imported=${orphanStats.importedFromOrthanc}`,
          `present=${orphanStats.alreadyPresent}`,
          `errors=${orphanStats.errors}`,
          `noName=${orphanStats.skippedNoName}`,
          `noUid=${orphanStats.skippedNoUid}`,
          `billedRowExists=${orphanStats.skippedBilledRowExists}`,
          `tooOld=${orphanStats.skippedTooOld}`,
        );
        if (orphanStats.errors > 0) {
          console.warn(
            "[sync] orphan create failures:",
            orphanStats.skippedReasons.slice(0, 3).join(" | "),
          );
        }
      } catch (e: any) {
        lastError = lastError ?? `orphan import failed: ${e?.message ?? String(e)}`;
        console.error("[sync] importOrthancOrphans threw:", e);
      }
    } else {
      lastError = lastError ?? us.error;
      console.warn("[sync] listRecentUltrasoundStudies:", us.error);
    }
  }

  // 4a. Billing badge refresh for open rows (accession-keyed — blank
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

  // The watermark only moves when CARE's rows all landed (see planCareCursor).
  const nextSyncAt = cursorPlan.action === "advance" ? cursorPlan.at : priorWatermark;
  const nextDeepPullAt = deepPullRan && cursorPlan.action === "advance" ? cursorPlan.at : priorDeepPullAt;

  await db.usgSyncState.upsert({
    where: { clinicId },
    create: {
      id: clinicId === "default" ? "singleton" : clinicId,
      clinicId,
      lastSyncAt: nextSyncAt,
      lastDeepPullAt: nextDeepPullAt,
      cursorHoldCount: cursorPlan.holds,
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Not configured — set CARE / Orthanc in Settings → Integrations",
    },
    update: {
      lastSyncAt: nextSyncAt,
      lastDeepPullAt: nextDeepPullAt,
      cursorHoldCount: cursorPlan.holds,
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Not configured — set CARE / Orthanc in Settings → Integrations",
    },
  });

  // Observability: counts (and safe skip reasons) in the audit trail and
  // the response. No patient data in the skip reasons, no secrets anywhere.
  // Spread carefully — orphan stats reuse names like skippedNoName/errors.
  const stats = {
    ...importStats,
    ...attachStats,
    orthancUsStudies: orphanStats.orthancUsStudies,
    importedFromOrthanc: orphanStats.importedFromOrthanc,
    orphanAlreadyPresent: orphanStats.alreadyPresent,
    orphanSkippedNoName: orphanStats.skippedNoName,
    orphanSkippedNoUid: orphanStats.skippedNoUid,
    orphanSkippedBilledRowExists: orphanStats.skippedBilledRowExists,
    orphanSkippedTooOld: orphanStats.skippedTooOld,
    orphanErrors: orphanStats.errors,
    cursorHeld: cursorPlan.action === "hold",
    cursorHoldCount: cursorPlan.holds,
    // Both reason lists, CARE first — the audit line and the UI toast read
    // this one array.
    skippedReasons: [...importStats.skippedReasons, ...orphanStats.skippedReasons],
  };
  const skippedTotal = stats.skippedNoName + stats.skippedMissingIdentity + stats.errors + stats.orphanErrors;
  const newOrders = stats.imported + stats.importedFromOrthanc;
  if (
    newOrders > 0 ||
    skippedTotal > 0 ||
    stats.ambiguousMatches > 0 ||
    stats.erpFinalizedNotLocal > 0
  ) {
    const bits: string[] = [];
    if (stats.imported) bits.push(`${stats.imported} new from CARE`);
    if (stats.importedFromOrthanc) bits.push(`${stats.importedFromOrthanc} new from Orthanc`);
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
    incremental,
    syncedAt: new Date().toISOString(),
  });
}

import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fetchBillingStatus, fetchWorklist, finalizeReport } from "@/lib/usg/careClient";
import { listStudies } from "@/lib/usg/orthancClient";
import { attachOrthancStudies, emptyAttachStats, emptySyncStats, importCareRows } from "@/lib/usg/careSync";
import { audit } from "@/lib/usg/audit";

/**
 * Worklist sync — three fail-soft steps (v6.1 identity model):
 *   1. CARE bill-desk rows → import ultrasound orders by identity
 *      (careWorklistId first, legacy accession second, never names)
 *   2. Orthanc studies → attach by exact StudyInstanceUID, then exact
 *      single-hit AccessionNumber; orders without a study stay visible
 *      as "Awaiting images" — nothing disappears silently
 *   3. Billing badge refresh (accession-keyed, blank accessions simply
 *      can't refresh — the ERP skips them too) + retry pending finalizes
 *      (the ERP resolves those by worklistId, so blank-accession orders
 *      report back fine)
 *
 * Every decision is counted in the response; skips carry a safe reason
 * (worklistId + reason — never patient data, never secrets).
 */
export async function POST() {
  const guard = await requireSession();
  if (guard) return guard;

  const s = await getSettings();
  const careConfigured = !!(s.careApiBase && s.careApiKey);
  const orthancConfigured = !!s.orthancUrl;
  let careOk = false;
  let orthancOk = false;
  let lastError: string | null = null;

  let importStats = emptySyncStats();
  let attachStats = emptyAttachStats();

  // 1. CARE worklist → import ultrasound orders by identity
  if (careConfigured) {
    const r = await fetchWorklist();
    if (r.ok) {
      careOk = true;
      importStats = await importCareRows(r.data);
    } else {
      lastError = r.error;
    }
  }

  // 2. Orthanc studies → attach by exact StudyInstanceUID / AccessionNumber
  if (orthancConfigured) {
    const r = await listStudies();
    if (r.ok) {
      orthancOk = true;
      attachStats = await attachOrthancStudies(r.data);
    } else {
      lastError = lastError ?? r.error;
    }
  }

  // 3a. Billing badge refresh for open rows (accession-keyed — blank
  // accessions have no billing join on the ERP side either; fail-soft).
  if (careOk) {
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

    // 3b. Retry pending CARE finalizes. The ERP resolves the order by
    // worklistId first (accession second), so blank-accession orders
    // finalize correctly; we always send both when we have them.
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
    const stillPending = await db.usgCareOrder.count({ where: { status: "REPORTED", careSyncedAt: null } });
    if (stillPending === 0 && lastError && /finalize|pcpndt|match center/i.test(lastError)) {
      lastError = null; // the last blocking finalize flushed
    }
  }

  await db.usgSyncState.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      lastSyncAt: new Date(),
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Not configured — set CARE / Orthanc in Settings → Integrations",
    },
    update: {
      lastSyncAt: new Date(),
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Not configured — set CARE / Orthanc in Settings → Integrations",
    },
  });

  // Observability: counts (and safe skip reasons) in the audit trail and
  // the response. No patient data in the skip reasons, no secrets anywhere.
  const stats = { ...importStats, ...attachStats };
  const skippedTotal = stats.skippedNoName + stats.skippedMissingIdentity + stats.errors;
  if (stats.imported > 0 || skippedTotal > 0 || stats.ambiguousMatches > 0) {
    const bits: string[] = [];
    if (stats.imported) bits.push(`${stats.imported} new`);
    if (stats.updatedExisting) bits.push(`${stats.updatedExisting} refreshed`);
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
    newOrders: stats.imported,
    lastError,
    stats,
    syncedAt: new Date().toISOString(),
  });
}

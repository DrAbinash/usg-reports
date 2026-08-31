import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fetchBillingStatus, fetchWorklist, finalizeReport, isUltrasoundModality, splitAgeSex } from "@/lib/usg/careClient";
import { listStudies } from "@/lib/usg/orthancClient";
import { audit } from "@/lib/usg/audit";

/**
 * Worklist sync — the same three-step rhythm the MRI studio runs:
 *   1. CARE bill-desk worklist → upsert by accession (USG rows only,
 *      never delete: a finalized order stays as the day's record)
 *   2. Orthanc studies → match by accession → carry the Study UID
 *   3. Billing badge refresh for open rows + retry pending CARE finalizes
 *
 * Every step fails soft: one unreachable system never blocks the other,
 * and the outcome is always recorded in UsgSyncState for the banner.
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
  let newOrders = 0;

  // 1. CARE worklist → upsert ultrasound orders by accession
  if (careConfigured) {
    const r = await fetchWorklist();
    if (r.ok) {
      careOk = true;
      for (const w of r.data) {
        if (!isUltrasoundModality(w.modality)) continue; // MRI/CT rows are not our business
        if (!w.accessionNumber || !w.patientName) continue;
        const { age, sex } = splitAgeSex(w.patientAge);
        const existing = await db.usgCareOrder.findUnique({ where: { accessionNumber: w.accessionNumber } });
        if (existing) {
          if (existing.status !== "REPORTED") {
            await db.usgCareOrder.update({
              where: { id: existing.id },
              data: {
                patientName: w.patientName ?? existing.patientName,
                patientAge: age || existing.patientAge,
                patientSex: sex || existing.patientSex,
                patientPhone: w.patientPhone ?? existing.patientPhone,
                patientAddress: w.patientAddress ?? existing.patientAddress,
                billNumber: w.billNumber ?? existing.billNumber,
                referringDoctor: w.referringDoctor ?? existing.referringDoctor,
                testName: w.testName ?? existing.testName,
                billingStatus: w.billingStatus ?? existing.billingStatus,
                billingUpdatedAt: w.billingStatus ? new Date() : existing.billingUpdatedAt,
                careWorklistId: w.worklistId ?? existing.careWorklistId,
                studyInstanceUid: w.studyInstanceUid ?? existing.studyInstanceUid,
                studyDate: w.studyDate ? new Date(w.studyDate) : existing.studyDate,
              },
            });
          }
        } else {
          await db.usgCareOrder.create({
            data: {
              accessionNumber: w.accessionNumber,
              careWorklistId: w.worklistId,
              patientName: w.patientName,
              patientAge: age,
              patientSex: sex || "F",
              patientPhone: w.patientPhone ?? "",
              patientAddress: w.patientAddress ?? "",
              billNumber: w.billNumber ?? "",
              referringDoctor: w.referringDoctor ?? "",
              testName: w.testName ?? "",
              modality: "USG",
              studyInstanceUid: w.studyInstanceUid ?? null,
              billingStatus: w.billingStatus ?? null,
              studyDate: w.studyDate ? new Date(w.studyDate) : null,
              status: "PENDING",
            },
          });
          newOrders++;
        }
      }
    } else {
      lastError = r.error;
    }
  }

  // 2. Orthanc studies → match by accession, carry the Study UID
  if (orthancConfigured) {
    const r = await listStudies();
    if (r.ok) {
      orthancOk = true;
      for (const st of r.data) {
        const accession = st.MainDicomTags?.AccessionNumber;
        if (!accession) continue;
        const existing = await db.usgCareOrder.findUnique({ where: { accessionNumber: accession } });
        if (existing) {
          await db.usgCareOrder.update({
            where: { id: existing.id },
            data: { studyInstanceUid: st.MainDicomTags.StudyInstanceUID ?? existing.studyInstanceUid },
          });
        }
      }
    } else {
      lastError = lastError ?? r.error;
    }
  }

  // 3a. Billing badge refresh for open rows
  if (careOk) {
    const open = await db.usgCareOrder.findMany({
      where: { status: { in: ["PENDING", "REPORTING"] }, billingStatus: { not: null } },
      select: { accessionNumber: true },
      take: 40,
    });
    if (open.length) {
      const r = await fetchBillingStatus(open.map((o) => o.accessionNumber));
      if (r.ok) {
        for (const [accession, status] of Object.entries(r.data)) {
          await db.usgCareOrder.updateMany({
            where: { accessionNumber: accession },
            data: { billingStatus: status, billingUpdatedAt: new Date() },
          });
        }
      }
    }

    // 3b. Retry pending CARE finalizes (finalized locally, ERP not yet told)
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
          detail: `ERP accepted finalize for ${p.accessionNumber}`,
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

  if (newOrders > 0) {
    await audit({ action: "worklist.sync", detail: `${newOrders} new ultrasound order(s) from the bill desk` });
  }

  return Response.json({
    ok: true,
    careOk,
    orthancOk,
    careConfigured,
    orthancConfigured,
    newOrders,
    lastError,
    syncedAt: new Date().toISOString(),
  });
}

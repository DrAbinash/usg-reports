import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fetchBillingStatus, fetchWorklist, finalizeReport } from "@/lib/careClient";
import { listStudies } from "@/lib/orthancClient";

/** Retry one pending finalize; returns true when CARE accepted it. */
async function finalizeReportPayload(p: { order: { accessionNumber: string; careWorklistId: string | null }; technique: string; findings: string; impression: string; recommendation: string }): Promise<boolean> {
  const s = await getSettings();
  const r = await finalizeReport({
    accessionNumber: p.order.accessionNumber,
    worklistId: p.order.careWorklistId,
    reportText: {
      technique: p.technique,
      findings: p.findings,
      impression: p.impression,
      recommendation: p.recommendation,
    },
    radiologistName: s.radiologistName,
    radiologistRegNumber: s.radiologistRegNo,
    finalizedAt: new Date().toISOString(),
  });
  return r.ok;
}

function guessRegion(testName: string, modality: string): string {
  const t = testName.toLowerCase();
  if (modality === "CT") {
    if (/spine|dorso|lumbar|cervical|sacrum|pott|spondyl/.test(t)) return "CT Spine";
    if (/chest|thorax|lung|koch/.test(t)) return "CT Chest";
    if (/abd|abdomen|pancrea|liver|kidney|kub|appendic/.test(t)) return "CT Abdomen";
    if (/pns|sinus|nose/.test(t)) return "CT PNS";
    if (/orbit|eye/.test(t)) return "CT Orbit";
    if (/mastoid|temporal|ear|csom/.test(t)) return "CT Temporal Bone";
    if (/face|zygo|maxill|nasal|mandib/.test(t)) return "CT Face";
    if (/neck|thyroid|goiter/.test(t)) return "CT Neck";
    if (/pelvis|acetab|sacro?coccy/.test(t)) return "CT Pelvis";
    return "CT Head";
  }
  // Whole-body / combined screening studies first (before part-level rules)
  if (/whole body/.test(t)) return "Whole Body Screening";
  if (/whole spine|\bwss\b/.test(t)) return "Whole Spine Screening";
  if (/screening/.test(t) && /cervical/.test(t) && /dorsal/.test(t)) return "Whole Spine Screening";
  // Musculoskeletal
  if (/knee/.test(t)) return "Knee Joint";
  if (/shoulder/.test(t)) return "Shoulder Joint";
  if (/elbow/.test(t)) return "Elbow Joint";
  if (/wrist|hand/.test(t)) return "Wrist Joint";
  if (/sacro|\bs\s*i\b|si joint/.test(t)) return "SI Joint";
  if (/ankle|foot|heel|calcane/.test(t)) return "Ankle Joint";
  // Neuroradiology
  if (/orbit|eye/.test(t)) return "Orbit";
  if (/mastoid|temporal bone/.test(t)) return "Mastoid";
  if (/brachial/.test(t)) return "Brachial Plexus";
  if (/dorso/.test(t)) return "DL Spine";
  if (/lumbar|lumbosacral|\bls\b/.test(t)) return "LS Spine";
  if (/cervical/.test(t)) return "Cervical Spine";
  if (/hip|femur|pelvis/.test(t)) return "Hip Joint";
  if (/brain|pituitary|head|sellar|cp angle|sell/.test(t)) return "Brain";
  return "Brain";
}

export async function POST() {
  const guard = await requireSession();
  if (guard) return guard;

  const s = await getSettings();
  const careConfigured = !!(s.careApiBase && s.careApiKey);
  const orthancConfigured = !!s.orthancUrl;
  let careOk = false;
  let orthancOk = false;
  let lastError: string | null = null;

  // 1. CARE worklist → upsert by accession (never delete local rows)
  if (careConfigured) {
    const r = await fetchWorklist();
    if (r.ok) {
      careOk = true;
      for (const w of r.data) {
        const existing = await db.careOrderLink.findUnique({ where: { accessionNumber: w.accessionNumber } });
        if (existing) {
          if (existing.status !== "REPORTED") {
            await db.careOrderLink.update({
              where: { id: existing.id },
              data: {
                patientName: w.patientName ?? existing.patientName,
                referringDoctor: w.referringDoctor ?? existing.referringDoctor,
                testName: w.testName ?? existing.testName,
                billingStatus: w.billingStatus ?? existing.billingStatus,
                billingUpdatedAt: w.billingStatus ? new Date() : null,
                careWorklistId: w.worklistId ?? existing.careWorklistId,
              },
            });
          }
        } else {
          await db.careOrderLink.create({
            data: {
              accessionNumber: w.accessionNumber,
              careWorklistId: w.worklistId,
              patientName: w.patientName,
              patientAge: w.patientAge ?? null,
              patientGender: w.patientGender ?? null,
              referringDoctor: w.referringDoctor ?? null,
              testName: w.testName ?? null,
              modality: (w.modality === "CT" ? "CT" : "MR"),
              bodyRegion: guessRegion(w.testName ?? "", w.modality === "CT" ? "CT" : "MR"),
              studyInstanceUid: w.studyInstanceUid ?? null,
              billingStatus: w.billingStatus ?? null,
              studyDate: w.studyDate ? new Date(w.studyDate) : null,
              status: w.studyInstanceUid ? "TO_REPORT" : "AWAITING_IMAGES",
            },
          });
        }
      }
    } else {
      lastError = r.error;
    }
  }

  // 2. Orthanc studies → match by accession, promote AWAITING_IMAGES → TO_REPORT
  if (orthancConfigured) {
    const r = await listStudies();
    if (r.ok) {
      orthancOk = true;
      for (const st of r.data) {
        const accession = st.MainDicomTags?.AccessionNumber;
        if (!accession) continue;
        const existing = await db.careOrderLink.findUnique({ where: { accessionNumber: accession } });
        if (existing) {
          await db.careOrderLink.update({
            where: { id: existing.id },
            data: {
              studyInstanceUid: st.MainDicomTags.StudyInstanceUID ?? existing.studyInstanceUid,
              status: existing.status === "REPORTED" ? "REPORTED" : "TO_REPORT",
            },
          });
        }
      }
    } else {
      lastError = lastError ?? r.error;
    }
  }

  // 3. Billing badge refresh for open rows
  if (careOk) {
    const open = await db.careOrderLink.findMany({
      where: { status: { in: ["TO_REPORT", "REPORTING"] }, billingStatus: { not: null } },
      select: { accessionNumber: true },
      take: 40,
    });
    if (open.length) {
      const r = await fetchBillingStatus(open.map((o) => o.accessionNumber));
      if (r.ok) {
        for (const [accession, status] of Object.entries(r.data)) {
          await db.careOrderLink.updateMany({
            where: { accessionNumber: accession },
            data: { billingStatus: status, billingUpdatedAt: new Date() },
          });
        }
      }
    }

    // 4. Retry pending CARE finalizes (reports finalized locally, CARE sync failed)
    const pending = await db.report.findMany({
      where: { status: "FINALIZED", careSyncedAt: null },
      include: { order: true },
      take: 10,
    });
    for (const p of pending) {
      const care = await finalizeReportPayload(p);
      if (care) {
        await db.report.update({ where: { id: p.id }, data: { careSyncedAt: new Date() } });
      }
    }
    if (pending.length > 0 && (await db.report.count({ where: { status: "FINALIZED", careSyncedAt: null } })) === 0) {
      lastError = null; // all pending finalizes flushed
    }
  }

  await db.syncState.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      lastSyncAt: new Date(),
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Demo mode — CARE/Orthanc not configured",
    },
    update: {
      lastSyncAt: new Date(),
      lastCareOk: careOk,
      lastOrthancOk: orthancOk,
      lastError: careConfigured || orthancConfigured ? lastError : "Demo mode — CARE/Orthanc not configured",
    },
  });

  return Response.json({
    ok: true,
    careOk,
    orthancOk,
    careConfigured,
    orthancConfigured,
    lastError,
    syncedAt: new Date().toISOString(),
  });
}

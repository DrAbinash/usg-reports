import { NextRequest, NextResponse } from "next/server";
import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { linkPatient } from "@/lib/usg/patients";
import { audit } from "@/lib/usg/audit";

export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();

  const body = await req.json();
  const { studyInstanceUid, patientName, patientAge, patientSex, referringDoctor, studyDate, testName } = body;

  if (!studyInstanceUid) return NextResponse.json({ error: "Missing studyInstanceUid" }, { status: 400 });

  // Idempotency: studyInstanceUid lives on UsgCareOrder (not UsgReport).
  // Re-open the linked draft when this PACS study was already started.
  const existingOrder = await db.usgCareOrder.findFirst({ where: { studyInstanceUid, clinicId } });
  if (existingOrder?.reportId) return NextResponse.json({ reportId: existingOrder.reportId });

  const patientId = await linkPatient(patientName || "UNKNOWN", "", clinicId);

  const report = await db.usgReport.create({
    data: {
      clinicId,
      patientId,
      patientName: patientName || "UNKNOWN",
      patientAge: String(patientAge || "").replace(/[^0-9]/g, ""),
      patientSex: patientSex === "M" ? "M" : "F",
      referredBy: referringDoctor || "Self/Walk-in",
      studyKey: "usg-generic",
      technique: "USG (PACS ONLY - UNBILLED)",
      stateJson: JSON.stringify({ source: "PACS_UNBILLED", studyInstanceUid }),
      scanDate: studyDate ? new Date(studyDate) : new Date(),
    },
  });

  if (existingOrder) {
    await db.usgCareOrder.update({
      where: { id: existingOrder.id },
      data: { reportId: report.id, status: "REPORTING" },
    });
  } else {
    await db.usgCareOrder.create({
      data: {
        clinicId,
        careWorklistId: `PACS-${studyInstanceUid}`,
        // Leave accession null — PACS-only drafts are keyed by studyInstanceUid;
        // copying a PatientID into the unique accession column would collide with CARE rows.
        patientName: patientName || "UNKNOWN",
        patientAge: String(patientAge || "").replace(/[^0-9]/g, ""),
        patientSex: patientSex === "M" ? "M" : "F",
        referringDoctor: referringDoctor || "Self/Walk-in",
        testName: testName || "USG Study",
        modality: "US",
        studyDate: studyDate ? new Date(studyDate) : new Date(),
        studyInstanceUid,
        reportId: report.id,
        status: "REPORTING",
      },
    });
  }

  await audit({
    clinicId,
    action: "report.pacsDraft",
    reportId: report.id,
    patientName,
    detail: `Created unbilled PACS draft for ${studyInstanceUid}`,
  });

  return NextResponse.json({ reportId: report.id });
}

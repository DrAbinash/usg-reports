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
  const { studyInstanceUid, patientName, patientAge, patientSex, referringDoctor, studyDate } = body;

  if (!studyInstanceUid) return NextResponse.json({ error: "Missing studyInstanceUid" }, { status: 400 });

  // Idempotency: if a draft for this UID already exists, just open it
  const existing = await db.usgReport.findFirst({ where: { studyInstanceUid, clinicId } });
  if (existing) return NextResponse.json({ reportId: existing.id });

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
      stateJson: JSON.stringify({ source: "PACS_UNBILLED" }),
      scanDate: studyDate ? new Date(studyDate) : new Date(),
      studyInstanceUid,
    }
  });

  await audit({
    clinicId,
    action: "report.pacsDraft",
    reportId: report.id,
    patientName,
    detail: `Created unbilled PACS draft for ${studyInstanceUid}`,
  });

  return NextResponse.json({ reportId: report.id });
}

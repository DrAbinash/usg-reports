/**
 * API: POST /api/usg/reports/[id]/pacs-return
 *
 * Pushes a finalized report to Orthanc as a DICOM SR instance.
 * Eligibility is checked server-side (fail-closed).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolve, makeLookup } from "@/lib/usg/composer";
import { getStudy } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { checkEligibility, uploadToOrthanc, type PacsReturnPayload } from "@/lib/usg/pacsReturn";
import { audit } from "@/lib/usg/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const report = await db.usgReport.findUnique({
    where: { id },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "FINALIZED") {
    return NextResponse.json(
      { error: "Only finalized reports can be returned to PACS" },
      { status: 409 },
    );
  }

  let state;
  try {
    state = JSON.parse(report.stateJson || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid report state" }, { status: 500 });
  }

  const study = getStudy(state.studyKey);
  if (!study) {
    return NextResponse.json({ error: "Unknown study type" }, { status: 400 });
  }

  // Look up the care order to get StudyInstanceUID + AccessionNumber
  const careOrder = await db.usgCareOrder.findFirst({
    where: { patientName: report.patientName },
    orderBy: { createdAt: "desc" },
  });

  const studyInstanceUid = careOrder?.studyInstanceUid ?? null;
  const accessionNumber = careOrder?.accessionNumber ?? null;

  const resolved = resolve(state, makeLookup(USG_PATHOLOGIES_ALL), study.technique);

  const payload: PacsReturnPayload = {
    studyInstanceUid: studyInstanceUid ?? "",
    accessionNumber,
    patientName: report.patientName,
    patientId: report.patientId,
    patientDob: null,
    patientSex: report.patientSex,
    reportText: resolved.sections.map((s) => `${s.label}:\n${s.text}`).join("\n\n"),
    findings: resolved.sections.map((s) => s.text).join("\n"),
    impression: resolved.impression.join("\n"),
    studyDate: report.scanDate ? report.scanDate.toISOString() : new Date().toISOString(),
    studyDescription: study.title,
    reportId: 0,
    reportSerial: report.serialNo ? `USG-${String(report.serialNo).padStart(4, "0")}` : report.id,
  };

  const eligibility = checkEligibility({
    status: report.status === "FINALIZED" ? "finalized" : "draft",
    studyInstanceUid,
    patientName: payload.patientName,
    pcpndtCompliant: true,
  });

  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: "Report is not eligible for PACS return", reasons: eligibility.reasons },
      { status: 409 },
    );
  }

  const result = await uploadToOrthanc(payload);

  if (result.ok) {
    await audit({
      action: "pacs_return",
      reportId: report.id,
      serialNo: report.serialNo,
      patientName: payload.patientName,
      detail: `Uploaded to Orthanc: ${result.orthancInstanceId ?? "unknown"}`,
    });

    return NextResponse.json({
      ok: true,
      orthancInstanceId: result.orthancInstanceId,
      message: "Report uploaded to PACS successfully",
    });
  } else {
    return NextResponse.json(
      { error: result.error ?? "PACS return failed" },
      { status: 502 },
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const report = await db.usgReport.findUnique({
    where: { id },
    select: { patientName: true, status: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Look up the care order for StudyInstanceUID
  const careOrder = await db.usgCareOrder.findFirst({
    where: { patientName: report.patientName },
    orderBy: { createdAt: "desc" },
    select: { studyInstanceUid: true },
  });

  if (!careOrder?.studyInstanceUid) {
    return NextResponse.json({ returned: false, reason: "No StudyInstanceUID linked to this report" });
  }

  const { checkPacsStatus } = await import("@/lib/usg/pacsReturn");
  const status = await checkPacsStatus(careOrder.studyInstanceUid);

  return NextResponse.json({
    returned: status.returned,
    instanceId: status.instanceId,
  });
}

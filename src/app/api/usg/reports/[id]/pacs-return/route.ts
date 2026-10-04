/**
 * API: POST /api/usg/reports/[id]/pacs-return
 *
 * Pushes a finalized report to Orthanc as a DICOM SR instance.
 * Eligibility is checked server-side (fail-closed).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolve, makeLookup } from "@/lib/usg/composer";
import { getStudy } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { checkEligibility, uploadToOrthanc, type PacsReturnPayload } from "@/lib/usg/pacsReturn";
import { audit } from "@/lib/usg/audit";
import { getSettings } from "@/lib/settings";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSession();
  if (guard) return guard;

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

  // The order that produced THIS report. Matching on patientName used to pick
  // the newest order sharing the name, so two patients with the same name sent
  // the SR onto the wrong study — and careSync.ts deliberately identifies
  // orders by UID / accession / worklist / bill number and never by name.
  const careOrder = await db.usgCareOrder.findFirst({
    where: { reportId: report.id },
    orderBy: { createdAt: "desc" },
  });

  if (!careOrder) {
    return NextResponse.json(
      { error: "This report is not linked to a CARE order, so its study cannot be identified. Return it from the worklist row instead." },
      { status: 409 },
    );
  }

  const studyInstanceUid = careOrder.studyInstanceUid ?? null;
  const accessionNumber = careOrder.accessionNumber ?? null;

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

  // PC-PNDT compliance is a claim about this clinic's registration, not a
  // constant to assert. The same number prints in the declaration block on the
  // sheet, so claiming compliance while it is unset would return a report that
  // cannot lawfully be returned.
  const settings = await getSettings();
  const pcpndtRegistered = Boolean(settings.pcpndtRegistrationNo?.trim());

  const eligibility = checkEligibility({
    status: report.status === "FINALIZED" ? "finalized" : "draft",
    studyInstanceUid,
    patientName: payload.patientName,
    pcpndtCompliant: pcpndtRegistered,
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
  const guard = await requireSession();
  if (guard) return guard;

  const { id } = await params;

  const report = await db.usgReport.findUnique({
    where: { id },
    select: { patientName: true, status: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Same identity rule as the POST above: the order that produced this report,
  // never "the newest order carrying this patient's name".
  const careOrder = await db.usgCareOrder.findFirst({
    where: { reportId: id },
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

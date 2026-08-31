import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { normaliseState } from "@/lib/usg/composer";
import { resolveColumns } from "@/lib/usg/server";
import { parseScanDate } from "@/lib/usg/dates";
import { linkPatient } from "@/lib/usg/patients";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({
    where: { id },
    include: { patient: true, images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ report });
}

export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const existing = await db.usgReport.findUnique({ where: { id }, include: { patient: true } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "FINALIZED") {
    return Response.json({ error: "Report is finalized and locked" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.patientName === "string" && body.patientName.trim()) data.patientName = body.patientName.trim();
  if (typeof body.patientAge === "string") data.patientAge = body.patientAge.trim();
  if (body.patientSex === "M" || body.patientSex === "F" || body.patientSex === "CHILD") data.patientSex = body.patientSex;
  if (typeof body.referredBy === "string") data.referredBy = body.referredBy.trim();
  // Registry: re-link the patient whenever name or phone changes.
  const nextName = typeof data.patientName === "string" ? data.patientName : existing.patientName;
  const nextPhone =
    typeof body.patientPhone === "string"
      ? body.patientPhone.trim()
      : existing.patient?.phone ?? "";
  if (typeof body.patientPhone === "string" || data.patientName) {
    data.patientId = await linkPatient(nextName, nextPhone);
  }
  // Scan date: back-dating is the doctor's register discipline — an explicit
  // "" clears it (falls back to finalizedAt/createdAt when printing), a
  // "yyyy-mm-dd" sets it; omitting the key leaves it untouched.
  if (typeof body.scanDate === "string") data.scanDate = parseScanDate(body.scanDate);

  let stateJson: string | null = null;
  if (body.state && typeof body.state === "object") {
    const studyKey = typeof body.studyKey === "string" && getStudy(body.studyKey) ? body.studyKey : existing.studyKey;
    const state = normaliseState(body.state, studyKey);
    stateJson = JSON.stringify(state);
    data.studyKey = state.studyKey;
  }
  if (typeof body.technique === "string") data.technique = body.technique;
  else if (!("technique" in body) && stateJson) data.technique = existing.technique;

  if (stateJson || "technique" in body || "patientName" in body) {
    const cols = await resolveColumns(stateJson ?? existing.stateJson, (data.technique as string) ?? existing.technique);
    Object.assign(data, cols);
  }

  const report = await db.usgReport.update({ where: { id }, data });
  await audit({
    action: "report.update",
    reportId: report.id,
    patientName: report.patientName,
    detail: "draft saved",
  });
  return Response.json({ report });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const existing = await db.usgReport.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await db.usgReport.delete({ where: { id } });
  await audit({
    action: "report.delete",
    reportId: id,
    patientName: existing.patientName,
    serialNo: existing.serialNo,
    detail: existing.serialNo != null ? `register no. ${existing.serialNo} removed from the list (gaps remain)` : "draft deleted",
  });
  return Response.json({ ok: true });
}

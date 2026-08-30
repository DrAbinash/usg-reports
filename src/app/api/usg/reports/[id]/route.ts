import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { normaliseState } from "@/lib/usg/composer";
import { resolveColumns } from "@/lib/usg/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ report });
}

export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const existing = await db.usgReport.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "FINALIZED") {
    return Response.json({ error: "Report is finalized and locked" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.patientName === "string" && body.patientName.trim()) data.patientName = body.patientName.trim();
  if (typeof body.patientAge === "string") data.patientAge = body.patientAge.trim();
  if (body.patientSex === "M" || body.patientSex === "F") data.patientSex = body.patientSex;
  if (typeof body.referredBy === "string") data.referredBy = body.referredBy.trim();

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
  return Response.json({ report });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const existing = await db.usgReport.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await db.usgReport.delete({ where: { id } });
  return Response.json({ ok: true });
}
